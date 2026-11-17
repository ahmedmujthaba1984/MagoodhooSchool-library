import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileJson,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCog,
} from 'lucide-react';
import {
  AccessRole,
  AcquisitionRequest,
  AuditActionType,
  AuditLogEntry,
  Book,
  LedgerTransaction,
  LibrarySettings,
  LibrarySnapshotArchive,
  Loan,
  NotificationTemplatePair,
  NotificationTemplateType,
  PersonalItem,
  Reservation,
  UserProfile,
} from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { usePermission } from '../hooks/usePermission';
import {
  PERMISSION_LABELS,
  Permission,
  ROLE_DEFINITIONS,
  resolveAccessRole,
} from '../lib/rbac';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  buildMailtoHref,
  groupOverdueLoansByClass,
  printOverdueClassSlips,
  renderNotificationTemplate,
} from '../lib/notifications';
import {
  BACKUP_SCHEMA_VERSION,
  countPhysicalCopies,
  parseAndValidateSnapshot,
} from '../lib/backupRestore';

interface SecurityBackupSuiteViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  books: Book[];
  loans: Loan[];
  reservations: Reservation[];
  ledgerTransactions: LedgerTransaction[];
  acquisitions: AcquisitionRequest[];
  personalItems: PersonalItem[];
  auditLogs: AuditLogEntry[];
  settings: LibrarySettings;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => void;
  onUpdateUserRole: (userId: string, accessRole: AccessRole) => Promise<void> | void;
  onExportBackup: (passphrase?: string) => Promise<void>;
  onRestoreBackup: (archive: LibrarySnapshotArchive) => Promise<void>;
  onRecordAuditEvent?: (params: {
    action: AuditActionType;
    targetType: AuditLogEntry['targetType'];
    targetId: string;
    details: string;
  }) => Promise<void> | void;
}

type SuiteSubTab = 'rbac' | 'notifications' | 'audit' | 'backup';

const PLACEHOLDER_TOKENS = [
  '{{patron_name}}',
  '{{book_title}}',
  '{{due_date}}',
  '{{fine_mvr}}',
];

const AUDIT_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'ALL', label: 'All Events' },
  { id: 'FINE_WAIVED', label: 'Fine Waived' },
  { id: 'FINE_SETTLED', label: 'Fine Settled' },
  { id: 'BALANCE_EDITED', label: 'Balance Edited' },
  { id: 'COPY_DELETED', label: 'Copy Deleted' },
  { id: 'BOOK_DELETED', label: 'Book Deleted' },
  { id: 'ROLE_CHANGED', label: 'Role Changed' },
  { id: 'POLICY_UPDATED', label: 'Policy Updated' },
  { id: 'BACKUP_EXPORTED', label: 'Backup Exported' },
  { id: 'BACKUP_RESTORED', label: 'Backup Restored' },
  { id: 'LOAN_ISSUED', label: 'Loan Issued' },
];

const ACCESS_ROLE_ORDER: AccessRole[] = [
  'super_admin',
  'desk_assistant',
  'teacher',
  'student_guest',
];

export const SecurityBackupSuiteView: React.FC<SecurityBackupSuiteViewProps> = ({
  currentUser,
  users,
  books,
  loans,
  reservations,
  ledgerTransactions,
  acquisitions,
  personalItems,
  auditLogs,
  settings,
  onUpdateSettings,
  onUpdateUserRole,
  onExportBackup,
  onRestoreBackup,
  onRecordAuditEvent,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isDv = language === 'dv';

  const { can, canAny, accessRole, roleMeta } = usePermission(currentUser);

  const initialTab: SuiteSubTab = can('users:manage_roles')
    ? 'rbac'
    : can('notifications:send')
    ? 'notifications'
    : can('audit:view')
    ? 'audit'
    : 'backup';

  const [activeSubTab, setActiveSubTab] = useState<SuiteSubTab>(initialTab);

  // ---------- TAB 1: RBAC STATE ----------
  const [roleSearch, setRoleSearch] = useState('');
  const superAdminCount = useMemo(
    () => users.filter((u) => resolveAccessRole(u) === 'super_admin').length,
    [users]
  );

  // ---------- TAB 2: NOTIFICATIONS STATE ----------
  const [templateType, setTemplateType] = useState<NotificationTemplateType>('overdue_notice');
  const [draftTemplates, setDraftTemplates] = useState<
    Record<NotificationTemplateType, NotificationTemplatePair>
  >(() => ({
    overdue_notice: {
      en: settings.notificationTemplates?.overdue_notice?.en || DEFAULT_NOTIFICATION_TEMPLATES.overdue_notice.en,
      dv: settings.notificationTemplates?.overdue_notice?.dv || DEFAULT_NOTIFICATION_TEMPLATES.overdue_notice.dv,
    },
    hold_ready: {
      en: settings.notificationTemplates?.hold_ready?.en || DEFAULT_NOTIFICATION_TEMPLATES.hold_ready.en,
      dv: settings.notificationTemplates?.hold_ready?.dv || DEFAULT_NOTIFICATION_TEMPLATES.hold_ready.dv,
    },
  }));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

  const overdueClassGroups = useMemo(
    () => groupOverdueLoansByClass(loans, users, settings, draftTemplates),
    [loans, users, settings, draftTemplates]
  );

  const filteredClassGroups = useMemo(
    () =>
      selectedClassFilter === 'ALL'
        ? overdueClassGroups
        : overdueClassGroups.filter((g) => g.gradeClass === selectedClassFilter),
    [overdueClassGroups, selectedClassFilter]
  );

  const pendingHoldNotices = useMemo(() => {
    const expiryDays = settings.holdExpiryDays || 3;
    return reservations
      .filter((r) => r.status === 'pending')
      .map((res) => {
        const patron = users.find((u) => u.id === res.userId || u.name === res.userName);
        const parent = patron?.parentId ? users.find((u) => u.id === patron.parentId) : undefined;
        const pickupDeadline = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];
        const patronUnpaid = loans
          .filter((l) => l.userId === res.userId && !l.feePaid && (l.lateFee || 0) > 0)
          .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);

        const vars = {
          patron_name: res.userName,
          book_title: res.bookTitle,
          due_date: pickupDeadline,
          fine_mvr: patronUnpaid,
          grade: patron?.grade || 'School Member',
        };
        return {
          reservation: res,
          patron,
          recipientEmail: parent?.email || patron?.email || '',
          gradeClass: patron?.grade || 'Member',
          messageEn: renderNotificationTemplate(draftTemplates.hold_ready.en, vars),
          messageDv: renderNotificationTemplate(draftTemplates.hold_ready.dv, vars),
        };
      });
  }, [reservations, users, loans, settings.holdExpiryDays, draftTemplates]);

  // ---------- TAB 3: AUDIT LOG STATE ----------
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      const matchesAction = auditFilter === 'ALL' || entry.action === auditFilter;
      const matchesQuery =
        !q ||
        entry.details.toLowerCase().includes(q) ||
        entry.performedBy.toLowerCase().includes(q) ||
        entry.targetId.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q);
      return matchesAction && matchesQuery;
    });
  }, [auditLogs, auditFilter, auditSearch]);

  // ---------- TAB 4: BACKUP & RESTORE STATE ----------
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [restoreRawText, setRestoreRawText] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [validatedArchive, setValidatedArchive] = useState<LibrarySnapshotArchive | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const permissionCategories = useMemo(() => {
    const grouped = new Map<string, Permission[]>();
    (Object.keys(PERMISSION_LABELS) as Permission[]).forEach((perm) => {
      const cat = PERMISSION_LABELS[perm].category;
      const list = grouped.get(cat) || [];
      list.push(perm);
      grouped.set(cat, list);
    });
    return Array.from(grouped.entries());
  }, []);

  const filteredRoleUsers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.grade || '').toLowerCase().includes(q) ||
        (u.studentIdCode || '').toLowerCase().includes(q)
    );
  }, [users, roleSearch]);

  if (!canAny(['audit:view', 'notifications:send', 'data:backup_restore', 'users:manage_roles'])) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-xl mx-auto my-8 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          {isDv ? 'ހުއްދަ ހަނިކުރެވިފައި' : 'Access Restricted — RBAC Guard'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {isDv
            ? `މިހާރުގެ ރޯލް (${roleMeta.labelDv}) އަކަށް ސެކިއުރިޓީ، އޮޑިޓް އަދި ބެކަޕް ޕެނަލް ހުޅުވުމުގެ ހުއްދައެއް ނެތެވެ.`
            : `Your current access role (${roleMeta.label}) does not include Security, RBAC, or Backup privileges.`}
        </p>
      </div>
    );
  }

  const handleSaveTemplates = () => {
    onUpdateSettings({ notificationTemplates: draftTemplates });
    toast.success(
      isDv ? 'ދިވެހި އަދި އިނގިރޭސި މެސެޖު ޓެމްޕްލޭޓްތައް ސޭވްކުރެވިއްޖެ.' : 'Bilingual notification templates saved.',
      'Templates Updated'
    );
  };

  const handleResetTemplates = () => {
    setDraftTemplates({
      overdue_notice: { ...DEFAULT_NOTIFICATION_TEMPLATES.overdue_notice },
      hold_ready: { ...DEFAULT_NOTIFICATION_TEMPLATES.hold_ready },
    });
    toast.info('Reset draft templates to school defaults.', 'Defaults Restored');
  };

  const handleAppendPlaceholder = (langKey: 'en' | 'dv', token: string) => {
    setDraftTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [langKey]: `${prev[templateType][langKey]} ${token}`.trim(),
      },
    }));
  };

  const handleCopyWhatsApp = async (id: string, messageEn: string, messageDv: string) => {
    const combined = `${messageEn}\n\n---\n${messageDv}`;
    try {
      await navigator.clipboard.writeText(combined);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
      toast.success(
        isDv ? 'ވަޓްސްއެޕް / ވައިބަރ އަށް ކޮޕީކުރެވިއްޖެ!' : 'Copied bilingual notice for WhatsApp / Viber.',
        'Copied to Clipboard'
      );
    } catch {
      toast.error('Clipboard access unavailable in this browser context.', 'Copy Failed');
    }
  };

  const handlePrintClassSlips = async () => {
    if (filteredClassGroups.length === 0) {
      toast.info('No overdue loans match the selected grade/class filter.', 'No Slips to Print');
      return;
    }
    printOverdueClassSlips(filteredClassGroups);
    if (onRecordAuditEvent) {
      const totalSlips = filteredClassGroups.reduce((s, g) => s + g.items.length, 0);
      await onRecordAuditEvent({
        action: 'NOTIFICATION_DISPATCHED',
        targetType: 'notification',
        targetId: selectedClassFilter,
        details: `Printed ${totalSlips} class-grouped bilingual overdue slip(s) across ${filteredClassGroups.length} grade/class stack(s).`,
      });
    }
  };

  const handleExportAuditCsv = () => {
    const headers = ['ID', 'Timestamp', 'Action', 'Target Type', 'Target ID', 'Actor', 'Access Role', 'Integrity Hash', 'Details'];
    const rows = filteredAuditLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.action}"`,
      `"${log.targetType}"`,
      `"${log.targetId}"`,
      `"${(log.performedBy || '').replace(/"/g, '""')}"`,
      `"${log.accessRole || log.userRole}"`,
      `"${log.integrityHash || ''}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `magoodhoo-immutable-audit-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Immutable audit trail CSV exported.', 'Audit Export');
  };

  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const text = await file.text();
    setRestoreRawText(text);
    const validation = await parseAndValidateSnapshot(text, restorePassphrase);
    if (validation.valid && validation.archive) {
      setValidatedArchive(validation.archive);
      setRestoreError(null);
    } else {
      setValidatedArchive(null);
      setRestoreError(validation.error || 'Snapshot validation failed.');
    }
  };

  const handleRevalidateRestore = async () => {
    if (!restoreRawText) return;
    const validation = await parseAndValidateSnapshot(restoreRawText, restorePassphrase);
    if (validation.valid && validation.archive) {
      setValidatedArchive(validation.archive);
      setRestoreError(null);
      toast.success('Snapshot schema and integrity checksum verified.', 'Archive Valid');
    } else {
      setValidatedArchive(null);
      setRestoreError(validation.error || 'Snapshot validation failed.');
    }
  };

  const handleExecuteRestore = async () => {
    if (!validatedArchive || isRestoring) return;
    setIsRestoring(true);
    try {
      await onRestoreBackup(validatedArchive);
      setValidatedArchive(null);
      setRestoreRawText('');
      setRestoreFileName('');
      setRestorePassphrase('');
    } finally {
      setIsRestoring(false);
    }
  };

  const totalCopiesCount = countPhysicalCopies(books);

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {isDv ? 'ސެކިއުރިޓީ، މެސެޖު އަދި ބެކަޕް ސޫޓް' : 'Governance, Bilingual Notices & Disaster Recovery'}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>
              {isDv
                ? 'ރޯލް ބޭސްޑް އެކްސެސް، ނޯޓިސް އަދި ޑޭޓާ ބެކަޕް'
                : 'RBAC Security, Bilingual Notifications & Backup Suite'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isDv
              ? '4 ރޯލްގެ ހުއްދަތަކާއި، ދިވެހި/އިނގިރޭސި ލޭޓް ފީ ނޯޓިސް އަދި އެންކްރިޕްޓްކުރެވޭ ބެކަޕް ބެލެހެއްޓެވުން.'
              : 'Manage 4-tier RBAC permissions, bilingual EN/DV overdue & hold slips, tamper-evident audit logs, and schema-validated snapshots.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Role</div>
            <div className="font-bold text-slate-900 dark:text-white">{roleMeta.label}</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">Audit Records</div>
            <div className="font-black text-emerald-700 dark:text-emerald-400">{auditLogs.length}</div>
          </div>
        </div>
      </div>

      {/* Suite Tab Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 flex items-center gap-1.5 overflow-x-auto">
        {can('users:manage_roles') && (
          <button
            type="button"
            onClick={() => setActiveSubTab('rbac')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'rbac'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="security-tab-rbac"
          >
            <UserCog className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'ރޯލްތަކާއި ހުއްދަތައް (RBAC)' : 'RBAC & User Roles'}</span>
          </button>
        )}

        {can('notifications:send') && (
          <button
            type="button"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'notifications'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="security-tab-notifications"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'ދިވެހި/އިނގިރޭސި ނޯޓިސް' : 'Bilingual Notices (EN / DV)'}</span>
          </button>
        )}

        {can('audit:view') && (
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="security-tab-audit"
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'އިމިއުޓަބަލް އޮޑިޓް ލޮގް' : 'Immutable Audit Log'}</span>
          </button>
        )}

        {can('data:backup_restore') && (
          <button
            type="button"
            onClick={() => setActiveSubTab('backup')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'backup'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="security-tab-backup"
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'ސްނެޕްޝޮޓް ބެކަޕް & ރިސްޓޯރ' : 'Snapshot Backup & Restore'}</span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: RBAC MATRIX & ROLE ASSIGNER                           */}
      {/* ============================================================ */}
      {activeSubTab === 'rbac' && can('users:manage_roles') && (
        <div className="space-y-6">
          {/* 4-Role Summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {ACCESS_ROLE_ORDER.map((roleId) => {
              const def = ROLE_DEFINITIONS[roleId];
              const isCurrent = accessRole === roleId;
              const memberCount = users.filter((u) => resolveAccessRole(u) === roleId).length;
              return (
                <div
                  key={roleId}
                  className={`rounded-2xl p-4 border bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 ${
                    isCurrent
                      ? 'border-emerald-500 dark:border-emerald-600'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {roleId}
                      </span>
                      <span className="font-mono tabular-nums text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {memberCount} user(s)
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {isDv ? def.labelDv : def.label}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isDv ? def.summaryDv : def.summary}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>Permissions</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {def.permissions.length} / {Object.keys(PERMISSION_LABELS).length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Permission Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {isDv ? 'ހުއްދަތަކުގެ މެޓްރިކްސް (4 ރޯލް)' : '4-Role Granular Permission Matrix'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Strict capability matrix enforced on both UI controls and Express API routes.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 text-start">Capability</th>
                    {ACCESS_ROLE_ORDER.map((r) => (
                      <th key={r} className="p-3 text-center whitespace-nowrap">
                        {r === 'super_admin'
                          ? 'Super Admin'
                          : r === 'desk_assistant'
                          ? 'Desk Assistant / Prefect'
                          : r === 'teacher'
                          ? 'Teacher'
                          : 'Student / Guest'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {permissionCategories.map(([category, perms]) => (
                    <React.Fragment key={category}>
                      <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                        <td
                          colSpan={5}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          {category}
                        </td>
                      </tr>
                      {perms.map((perm) => {
                        const meta = PERMISSION_LABELS[perm];
                        return (
                          <tr key={perm} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {isDv ? meta.labelDv : meta.label}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">{perm}</div>
                            </td>
                            {ACCESS_ROLE_ORDER.map((roleId) => {
                              const allowed = ROLE_DEFINITIONS[roleId].permissions.includes(perm);
                              return (
                                <td key={roleId} className="p-3 text-center">
                                  {allowed ? (
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                      Allowed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-semibold">
                                      Blocked
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live User Role Assigner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isDv ? 'މެންބަރުންގެ އެކްސެސް ރޯލް ބަދަލުކުރުން' : 'Assign User Access Roles'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every role change is persisted and recorded in the immutable audit log. At least one Super Admin must remain active.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Filter name, ID, grade..."
                  className="w-full ps-8 pe-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-96">
              <table className="w-full text-start text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 text-start">Member</th>
                    <th className="p-3 text-start">ID / Grade</th>
                    <th className="p-3 text-start">Current RBAC Role</th>
                    <th className="p-3 text-end">Assign Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRoleUsers.map((member) => {
                    const effective = resolveAccessRole(member);
                    const isLastSuperAdmin = effective === 'super_admin' && superAdminCount <= 1;
                    return (
                      <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            <bdi>{member.name}</bdi>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            <bdi>{member.email}</bdi>
                          </div>
                        </td>
                        <td className="p-3 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                          <bdi>{member.studentIdCode || member.staffIdCode || member.grade || member.role}</bdi>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {ROLE_DEFINITIONS[effective].label}
                          </span>
                        </td>
                        <td className="p-3 text-end">
                          <select
                            aria-label={`Access role for ${member.name}`}
                            value={effective}
                            disabled={isLastSuperAdmin}
                            title={
                              isLastSuperAdmin
                                ? 'Cannot demote the last active Super Admin'
                                : 'Change user access role'
                            }
                            onChange={(e) => {
                              const nextRole = e.target.value as AccessRole;
                              if (nextRole !== effective) {
                                onUpdateUserRole(member.id, nextRole);
                              }
                            }}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 disabled:opacity-50 cursor-pointer"
                          >
                            {ACCESS_ROLE_ORDER.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_DEFINITIONS[r].label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: BILINGUAL NOTIFICATION GENERATOR & CLASS SLIPS        */}
      {/* ============================================================ */}
      {activeSubTab === 'notifications' && can('notifications:send') && (
        <div className="space-y-6">
          {/* Template Editor */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isDv
                    ? 'ދިވެހި އަދި އިނގިރޭސި ނޯޓިސް ޓެމްޕްލޭޓްތައް'
                    : 'Customizable Bilingual Notification Templates'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any placeholder token to insert dynamic patron, title, due date, and MVR fine values.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateType('overdue_notice')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    templateType === 'overdue_notice'
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Overdue &amp; Fines
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('hold_ready')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    templateType === 'hold_ready'
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Hold Ready
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* English Template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    English Template (LTR)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PLACEHOLDER_TOKENS.map((tok) => (
                      <button
                        key={`en-${tok}`}
                        type="button"
                        onClick={() => handleAppendPlaceholder('en', tok)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px] cursor-pointer"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  dir="ltr"
                  value={draftTemplates[templateType].en}
                  onChange={(e) =>
                    setDraftTemplates((prev) => ({
                      ...prev,
                      [templateType]: { ...prev[templateType], en: e.target.value },
                    }))
                  }
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 leading-relaxed"
                />
              </div>

              {/* Dhivehi Template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Dhivehi Template (ދިވެހި RTL)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PLACEHOLDER_TOKENS.map((tok) => (
                      <button
                        key={`dv-${tok}`}
                        type="button"
                        onClick={() => handleAppendPlaceholder('dv', tok)}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px] cursor-pointer"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  dir="rtl"
                  value={draftTemplates[templateType].dv}
                  onChange={(e) =>
                    setDraftTemplates((prev) => ({
                      ...prev,
                      [templateType]: { ...prev[templateType], dv: e.target.value },
                    }))
                  }
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-faruma text-slate-900 dark:text-slate-100 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleResetTemplates}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveTemplates}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Bilingual Templates</span>
              </button>
            </div>
          </div>

          {/* Overdue Class Groups + Hold Ready Recipients */}
          {templateType === 'overdue_notice' ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Overdue Notices Grouped by Grade / Class ({overdueClassGroups.length} classes)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Copy EN+DV notices for WhatsApp/Viber, launch email drafts, or print A4 slips stacked by class teacher.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="ALL">All Grades / Classes</option>
                    {overdueClassGroups.map((g) => (
                      <option key={g.gradeClass} value={g.gradeClass}>
                        {g.gradeClass} ({g.items.length})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handlePrintClassSlips}
                    disabled={filteredClassGroups.length === 0}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    id="print-class-overdue-slips-btn"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Class Overdue Slips</span>
                  </button>
                </div>
              </div>

              {filteredClassGroups.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                  No active overdue loans found. Every borrowed item is within its school return window.
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredClassGroups.map((group) => (
                    <div
                      key={group.gradeClass}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                        <div className="font-black text-xs text-slate-900 dark:text-white">
                          <bdi>{group.gradeClass}</bdi>
                        </div>
                        <div className="font-mono tabular-nums text-xs font-bold text-rose-700 dark:text-rose-400">
                          {group.items.length} overdue · Total MVR {group.totalFineMvr.toFixed(2)}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {group.items.map((item) => {
                          const isCopied = copiedId === item.loan.id;
                          const mailHref = buildMailtoHref({
                            toEmail: item.recipientEmail,
                            subject: `Library Overdue Notice: ${item.loan.bookTitle} (${item.loan.userName})`,
                            body: `${item.messageEn}\n\n---\n${item.messageDv}`,
                          });
                          return (
                            <div key={item.loan.id} className="p-4 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs">
                                  <span className="font-black text-slate-900 dark:text-white">
                                    <bdi>{item.loan.userName}</bdi>
                                  </span>
                                  <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    <bdi>{item.loan.bookTitle}</bdi>
                                  </span>
                                  <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                                  <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
                                    Due <bdi>{item.loan.dueDate}</bdi> · MVR {item.fineMvr.toFixed(2)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyWhatsApp(item.loan.id, item.messageEn, item.messageDv)
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                  >
                                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{isCopied ? 'Copied!' : 'Copy WhatsApp/Viber'}</span>
                                  </button>

                                  <a
                                    href={mailHref}
                                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>Email</span>
                                  </a>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {item.messageEn}
                                </div>
                                <div
                                  dir="rtl"
                                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-faruma text-slate-800 dark:text-slate-200 leading-relaxed"
                                >
                                  {item.messageDv}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Pending Hold-Ready Notifications ({pendingHoldNotices.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notify patrons in both English and Dhivehi when their reserved book arrives at the circulation counter.
                </p>
              </div>

              {pendingHoldNotices.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                  No pending patron holds in the queue.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingHoldNotices.map((hold) => {
                    const isCopied = copiedId === hold.reservation.id;
                    const mailHref = buildMailtoHref({
                      toEmail: hold.recipientEmail,
                      subject: `Reserved Book Ready: ${hold.reservation.bookTitle}`,
                      body: `${hold.messageEn}\n\n---\n${hold.messageDv}`,
                    });
                    return (
                      <div
                        key={hold.reservation.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="font-black text-slate-900 dark:text-white">
                              <bdi>{hold.reservation.userName}</bdi>
                            </span>
                            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              <bdi>{hold.reservation.bookTitle}</bdi>
                            </span>
                            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              <bdi>{hold.gradeClass}</bdi>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyWhatsApp(hold.reservation.id, hold.messageEn, hold.messageDv)
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'Copied!' : 'Copy WhatsApp/Viber'}</span>
                            </button>
                            <a
                              href={mailHref}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email</span>
                            </a>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {hold.messageEn}
                          </div>
                          <div
                            dir="rtl"
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-faruma text-slate-800 dark:text-slate-200"
                          >
                            {hold.messageDv}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: IMMUTABLE ACTIVITY AUDIT LOG                          */}
      {/* ============================================================ */}
      {activeSubTab === 'audit' && can('audit:view') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{isDv ? 'އިމިއުޓަބަލް އޮޑިޓް ޓްރެއިލް' : 'Immutable Activity Audit Trail'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Append-only compliance ledger for fine waivers, deleted books/copies, role changes, policies, and snapshots. Update and delete operations are blocked in Firestore rules.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold border border-slate-800 dark:border-slate-700 transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {AUDIT_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAuditFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    auditFilter === opt.id
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search details, actor, target..."
                className="w-full ps-8 pe-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[520px] border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-start text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 text-start">Timestamp</th>
                  <th className="p-3 text-start">Action</th>
                  <th className="p-3 text-start">Target ID</th>
                  <th className="p-3 text-start">Details</th>
                  <th className="p-3 text-start">Actor &amp; Role</th>
                  <th className="p-3 text-end">Integrity Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No audit events match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <bdi>{entry.timestamp.replace('T', ' ').slice(0, 19)}</bdi>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {entry.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                        <bdi>{entry.targetId}</bdi>
                      </td>
                      <td className="p-3 text-slate-800 dark:text-slate-200 max-w-md">{entry.details}</td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          <bdi>{entry.performedBy}</bdi>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {entry.accessRole || entry.userRole}
                        </div>
                      </td>
                      <td className="p-3 text-end font-mono tabular-nums text-[10px] text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        <bdi>{entry.integrityHash || 'IMMUTABLE'}</bdi>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: ONE-CLICK SNAPSHOT BACKUP & VALIDATED RESTORE         */}
      {/* ============================================================ */}
      {activeSubTab === 'backup' && can('data:backup_restore') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Snapshot Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    <span>{isDv ? 'ފުރިހަމަ ސްނެޕްޝޮޓް ބެކަޕް' : 'One-Click Complete Snapshot Backup'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Export all titles, physical copies, patrons, loans, holds, MVR ledger entries, acquisitions, audit logs, and school policies into a single versioned archive.
                  </p>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  v{BACKUP_SCHEMA_VERSION}
                </span>
              </div>

              {/* Live Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
                {[
                  { label: 'Titles', value: books.length },
                  { label: 'Copies', value: totalCopiesCount },
                  { label: 'Patrons', value: users.length },
                  { label: 'Loans', value: loans.length },
                  { label: 'Holds', value: reservations.length },
                  { label: 'Ledger', value: ledgerTransactions.length },
                  { label: 'Acq.', value: acquisitions.length },
                  { label: 'Personal', value: personalItems.length },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="text-[10px] font-sans font-bold uppercase text-slate-400">{stat.label}</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Optional AES-256 Passphrase */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Optional AES-256-GCM Encryption Passphrase</span>
                </label>
                <input
                  type="password"
                  value={exportPassphrase}
                  onChange={(e) => setExportPassphrase(e.target.value)}
                  placeholder="Leave blank for standard JSON snapshot"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isExporting}
              onClick={async () => {
                setIsExporting(true);
                try {
                  await onExportBackup(exportPassphrase.trim() || undefined);
                } finally {
                  setIsExporting(false);
                }
              }}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="download-snapshot-backup-btn"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Building Verified Archive...'
                  : exportPassphrase.trim()
                  ? 'Download AES-256 Encrypted Snapshot (.enc.json)'
                  : 'Download Complete JSON Snapshot (.json)'}
              </span>
            </button>
          </div>

          {/* Schema-Validated Restore Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-sky-700 dark:text-sky-400" />
                  <span>{isDv ? 'ސްނެޕްޝޮޓް ރިސްޓޯރ (ވެލިޑޭޝަންއާއެކު)' : 'Schema-Validated One-Click Restore'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Archives undergo strict <span className="font-mono">appId</span>,{' '}
                  <span className="font-mono">schemaVersion</span>, and integrity checksum verification before any records are replaced.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-center space-y-1">
                  <FileJson className="w-6 h-6 text-slate-500 dark:text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {restoreFileName ? `Selected: ${restoreFileName}` : 'Choose Magoodhoo Snapshot (.json / .enc.json)'}
                  </div>
                  <div className="text-[11px] text-slate-400">Click to browse local snapshot archive</div>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleSelectRestoreFile}
                    className="hidden"
                    id="snapshot-restore-file-input"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Decryption passphrase (if .enc.json)"
                    className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleRevalidateRestore}
                    disabled={!restoreRawText}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    Verify File
                  </button>
                </div>

                {restoreError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>{restoreError}</span>
                  </div>
                )}

                {validatedArchive && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
                    <div className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Archive Schema &amp; Checksum Validated</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-mono tabular-nums text-[11px] text-emerald-800 dark:text-emerald-300">
                      <div>Schema: {validatedArchive.schemaVersion}</div>
                      <div>Checksum: {validatedArchive.checksum}</div>
                      <div>Titles: {validatedArchive.counts.titles}</div>
                      <div>Copies: {validatedArchive.counts.copies}</div>
                      <div>Patrons: {validatedArchive.counts.patrons}</div>
                      <div>Loans: {validatedArchive.counts.loans}</div>
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Restoring will replace active catalog, patron, loan, and ledger state.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!validatedArchive || isRestoring}
              onClick={handleExecuteRestore}
              className="w-full py-3 rounded-xl bg-slate-900 dark:bg-sky-700 hover:bg-slate-800 dark:hover:bg-sky-600 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              id="confirm-restore-snapshot-btn"
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Restoring Verified Snapshot...' : 'Confirm & Restore Verified Snapshot'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
