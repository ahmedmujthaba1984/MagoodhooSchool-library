import {
  LibrarySettings,
  Loan,
  NotificationTemplatePair,
  NotificationTemplateType,
  UserProfile
} from '../types';
import { calculateWorkingDaysOverdue, DEFAULT_MALDIVES_SCHOOL_HOLIDAYS } from './schoolCalendar';

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationTemplateType, NotificationTemplatePair> = {
  overdue_notice: {
    en: 'Assalaamu Alaikum {{patron_name}}, your library book "{{book_title}}" was due on {{due_date}}. Current overdue balance is MVR {{fine_mvr}}. Please return the book to F. Magoodhoo School Library counter at your earliest convenience.',
    dv: 'އައްސަލާމް ޢަލައިކުމް {{patron_name}}، ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީން ގެންދެވި "{{book_title}}" މި ފޮތް އަނބުރާ ހަވާލުކުރަންޖެހޭ ތާރީޚު ({{due_date}}) ވަނީ ފަހަނައަޅާފައެވެ. މިވަގުތު އަރާފައިވާ ޖޫރިމަނާއަކީ MVR {{fine_mvr}} އެވެ. ވީއެންމެ އަވަހަކަށް ލައިބްރަރީއަށް ފޮތް ހަވާލުކޮށްދެއްވުން އެދެމެވެ.',
  },
  hold_ready: {
    en: 'Assalaamu Alaikum {{patron_name}}, good news! Your reserved book "{{book_title}}" is ready for pickup at F. Magoodhoo School Library counter until {{due_date}}. Account balance: MVR {{fine_mvr}}.',
    dv: 'އައްސަލާމް ޢަލައިކުމް {{patron_name}}، ތިޔަ ބޭފުޅާ ނަންނޯޓު ކުރައްވާފައިވާ "{{book_title}}" މި ފޮތް މިހާރު ލައިބްރަރީ ކައުންޓަރުން ލިބެން އެބަހުއްޓެވެ. {{due_date}} ގެ ކުރިން ފޮތް ގެންދެވުން އެދެމެވެ. އެކައުންޓް ބެލެންސް: MVR {{fine_mvr}}.',
  },
};

export interface NotificationVariables {
  patron_name: string;
  book_title: string;
  due_date: string;
  fine_mvr: string | number;
  grade?: string;
}

export function renderNotificationTemplate(
  template: string,
  vars: NotificationVariables
): string {
  const fineFormatted =
    typeof vars.fine_mvr === 'number'
      ? vars.fine_mvr.toFixed(2)
      : String(vars.fine_mvr ?? '0.00');

  return String(template || '')
    .replace(/\{\{\s*patron_name\s*\}\}/gi, vars.patron_name || 'Patron')
    .replace(/\{\{\s*book_title\s*\}\}/gi, vars.book_title || 'Library Title')
    .replace(/\{\{\s*due_date\s*\}\}/gi, vars.due_date || 'N/A')
    .replace(/\{\{\s*fine_mvr\s*\}\}/gi, fineFormatted)
    .replace(/\{\{\s*grade\s*\}\}/gi, vars.grade || 'School Member');
}

export function buildMailtoHref(params: {
  toEmail?: string;
  subject: string;
  body: string;
}): string {
  const target = encodeURIComponent((params.toEmail || '').trim()).replace(/%40/g, '@');
  const query = new URLSearchParams({
    subject: params.subject,
    body: params.body,
  }).toString();
  return `mailto:${target}?${query}`;
}

export interface OverdueNoticeItem {
  loan: Loan;
  patron?: UserProfile;
  gradeClass: string;
  daysOverdue: number;
  fineMvr: number;
  recipientEmail: string;
  messageEn: string;
  messageDv: string;
}

export interface OverdueClassGroup {
  gradeClass: string;
  items: OverdueNoticeItem[];
  totalFineMvr: number;
}

export function resolveNotificationTemplates(
  templates?: Partial<Record<NotificationTemplateType, Partial<NotificationTemplatePair>>>
): Record<NotificationTemplateType, NotificationTemplatePair> {
  return {
    overdue_notice: {
      en: templates?.overdue_notice?.en || DEFAULT_NOTIFICATION_TEMPLATES.overdue_notice.en,
      dv: templates?.overdue_notice?.dv || DEFAULT_NOTIFICATION_TEMPLATES.overdue_notice.dv,
    },
    hold_ready: {
      en: templates?.hold_ready?.en || DEFAULT_NOTIFICATION_TEMPLATES.hold_ready.en,
      dv: templates?.hold_ready?.dv || DEFAULT_NOTIFICATION_TEMPLATES.hold_ready.dv,
    },
  };
}

export function groupOverdueLoansByClass(
  loans: Loan[],
  users: UserProfile[],
  settings: LibrarySettings,
  templates?: Record<NotificationTemplateType, NotificationTemplatePair>,
  referenceDate: Date = new Date()
): OverdueClassGroup[] {
  const activeTemplates = resolveNotificationTemplates(templates || settings.notificationTemplates);
  const holidays = (settings.holidayGraceDays ?? true)
    ? (settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS)
    : [];
  const todayIso = referenceDate.toISOString().split('T')[0];

  const overdueLoans = loans.filter(
    (l) => l.status === 'overdue' || (l.status === 'active' && l.dueDate < todayIso)
  );

  const groupedMap = new Map<string, OverdueNoticeItem[]>();

  for (const loan of overdueLoans) {
    const patron = users.find((u) => u.id === loan.userId || u.name === loan.userName);
    const parent = patron?.parentId ? users.find((u) => u.id === patron.parentId) : undefined;
    const gradeClass =
      loan.userGrade ||
      patron?.grade ||
      (patron?.role === 'staff' ? patron.staffDepartment || 'Faculty & Staff' : 'Unassigned Grade');

    const workingDaysOverdue = calculateWorkingDaysOverdue(
      loan.dueDate,
      todayIso,
      settings.holidayGraceDays ?? true,
      holidays
    );
    const daysOverdue = Math.max(1, workingDaysOverdue);
    const billableDays = Math.max(0, workingDaysOverdue - (settings.gracePeriodDays ?? 0));
    const computedFine =
      (loan.lateFee || 0) > 0
        ? Math.max(0, (loan.lateFee || 0) - (loan.amountPaid || 0))
        : Math.min(
            settings.maxOverdueFineCap || 100,
            billableDays * (settings.lateFeePerDay || 2)
          );

    const vars: NotificationVariables = {
      patron_name: loan.userName,
      book_title: loan.bookTitle,
      due_date: loan.dueDate,
      fine_mvr: computedFine,
      grade: gradeClass,
    };

    const item: OverdueNoticeItem = {
      loan,
      patron,
      gradeClass,
      daysOverdue,
      fineMvr: Number(computedFine.toFixed(2)),
      recipientEmail: parent?.email || patron?.email || '',
      messageEn: renderNotificationTemplate(activeTemplates.overdue_notice.en, vars),
      messageDv: renderNotificationTemplate(activeTemplates.overdue_notice.dv, vars),
    };

    const list = groupedMap.get(gradeClass) || [];
    list.push(item);
    groupedMap.set(gradeClass, list);
  }

  return Array.from(groupedMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([gradeClass, items]) => ({
      gradeClass,
      items: items.sort((a, b) => a.loan.userName.localeCompare(b.loan.userName)),
      totalFineMvr: Number(items.reduce((sum, i) => sum + i.fineMvr, 0).toFixed(2)),
    }));
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOverdueClassSlipsHtml(groups: OverdueClassGroup[]): string {
  const sectionsHtml = groups
    .map((group) => {
      const slipsHtml = group.items
        .map(
          (item) => `
          <div style="border:1.5px dashed #64748b;border-radius:10px;padding:12px 14px;background:#ffffff;break-inside:avoid;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px;">
              <div>
                <div style="font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#047857;">
                  F. Magoodhoo School Library · Overdue Slip
                </div>
                <div style="font-size:13px;font-weight:900;color:#0f172a;margin-top:1px;">
                  ${escapeHtml(item.loan.userName)} (${escapeHtml(group.gradeClass)})
                </div>
              </div>
              <div style="text-align:right;font-family:'JetBrains Mono',monospace;">
                <div style="font-size:12px;font-weight:900;color:#b91c1c;">MVR ${item.fineMvr.toFixed(2)}</div>
                <div style="font-size:9px;color:#475569;">Due: ${escapeHtml(item.loan.dueDate)}</div>
              </div>
            </div>

            <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:6px;">
              Book: ${escapeHtml(item.loan.bookTitle)}
              ${item.loan.copyBarcode ? ` <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#475569;">[${escapeHtml(item.loan.copyBarcode)}]</span>` : ''}
            </div>

            <p style="font-size:10.5px;line-height:1.45;color:#1e293b;margin:0 0 6px;">
              ${escapeHtml(item.messageEn)}
            </p>
            <p style="font-family:'Faruma','Noto Sans Thaana',sans-serif;font-size:11px;line-height:1.55;color:#0f172a;margin:0;text-align:right;" dir="rtl">
              ${escapeHtml(item.messageDv)}
            </p>
          </div>
        `
        )
        .join('');

      return `
        <section style="margin-bottom:20px;break-inside:avoid-page;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#ffffff;padding:8px 14px;border-radius:8px;margin-bottom:10px;">
            <div>
              <span style="font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#34d399;">Class Teacher Distribution Stack</span>
              <h2 style="font-size:14px;font-weight:900;margin:1px 0 0;">${escapeHtml(group.gradeClass)}</h2>
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;">
              ${group.items.length} slip(s) · Total MVR ${group.totalFineMvr.toFixed(2)}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            ${slipsHtml}
          </div>
        </section>
      `;
    })
    .join('');

  return `
    <div style="padding:14px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #047857;padding-bottom:8px;margin-bottom:16px;">
        <div>
          <strong style="font-size:15px;">F. Magoodhoo School Library — Class-Grouped Overdue Notice Slips</strong>
          <div style="font-size:11px;color:#475569;">Grouped by Grade/Class for bulk homeroom teacher distribution</div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;">
          Generated ${new Date().toISOString().split('T')[0]}
        </span>
      </div>
      ${sectionsHtml}
    </div>
  `;
}

export function printOverdueClassSlips(groups: OverdueClassGroup[]) {
  if (!groups || groups.length === 0) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const existing = document.getElementById('magoodhoo-print-sheet-portal');
  if (existing) existing.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'magoodhoo-print-sheet-style';
  styleEl.textContent = `
    #magoodhoo-print-sheet-portal { display: none; }
    @media print {
      body > *:not(#magoodhoo-print-sheet-portal) { display: none !important; }
      #magoodhoo-print-sheet-portal { display: block !important; background: #fff !important; color: #0f172a !important; }
    }
  `;

  const container = document.createElement('div');
  container.id = 'magoodhoo-print-sheet-portal';
  container.innerHTML = buildOverdueClassSlipsHtml(groups);

  const oldStyle = document.getElementById('magoodhoo-print-sheet-style');
  if (oldStyle) oldStyle.remove();

  document.head.appendChild(styleEl);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    styleEl.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
}
