import { Book, LedgerTransaction, Loan, UserProfile } from '../types';
import { generateCode128Bars, generateQrMatrix } from './barcodeSvg';

export type BarcodeLabelStyle = 'code128' | 'qr' | 'both';

export interface PrintableStickerItem {
  title: string;
  code: string;
  ddcCallNumber?: string;
  shelfLocation?: string;
  accessionNumber?: string;
  isReferenceOnly?: boolean;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCode128SvgString(code: string, height = 38): string {
  const { bars, totalWidth } = generateCode128Bars(code);
  const rects = bars
    .map((b) => `<rect x="${b.x}" y="2" width="${b.width}" height="${height - 4}" fill="#0f172a" />`)
    .join('');
  return `<svg viewBox="0 0 ${totalWidth} ${height}" style="width:100%;max-width:210px;height:${height}px;display:block;margin:0 auto;" role="img" aria-label="Barcode ${escapeHtml(code)}"><rect width="${totalWidth}" height="${height}" fill="#ffffff" />${rects}</svg>`;
}

function renderQrSvgString(code: string, sizePx = 56): string {
  const matrix = generateQrMatrix(code, 21);
  const cell = 2;
  const dim = matrix.length * cell;
  const rects: string[] = [];
  matrix.forEach((row, r) => {
    row.forEach((filled, c) => {
      if (filled) {
        rects.push(`<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#0f172a" />`);
      }
    });
  });
  return `<svg viewBox="0 0 ${dim} ${dim}" style="width:${sizePx}px;height:${sizePx}px;display:block;margin:0 auto;background:#ffffff;" role="img" aria-label="QR ${escapeHtml(code)}"><rect width="${dim}" height="${dim}" fill="#ffffff" />${rects.join('')}</svg>`;
}

function mountAndPrintSheet(htmlContent: string) {
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
  container.innerHTML = htmlContent;

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

/**
 * Generates an A4 Avery-style Code-128 / QR spine sticker sheet (3 columns x N rows)
 * without opening popups (strictly compliant with iFrame / no window.open constraints).
 */
export function printBarcodeStickerSheet(
  items: PrintableStickerItem[],
  sheetTitle = 'F. Magoodhoo School Library — Spine & Copy Labels',
  labelStyle: BarcodeLabelStyle = 'code128'
) {
  if (!items || items.length === 0) return;

  const cardsHtml = items
    .map((item) => {
      const codeVisual =
        labelStyle === 'qr'
          ? renderQrSvgString(item.code, 54)
          : labelStyle === 'both'
          ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;">
              <div style="flex:1;min-width:0;">${renderCode128SvgString(item.code, 32)}</div>
              <div style="flex-shrink:0;">${renderQrSvgString(item.code, 38)}</div>
            </div>`
          : renderCode128SvgString(item.code, 34);

      return `
      <div style="border:1px dashed #94a3b8;border-radius:8px;padding:10px 12px;text-align:center;background:#ffffff;break-inside:avoid;page-break-inside:avoid;">
        <div style="font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin-bottom:3px;">
          F. Magoodhoo School Library
        </div>
        <div style="font-size:11px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">
          ${escapeHtml(item.title)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:#047857;margin-bottom:5px;">
          ${escapeHtml(item.ddcCallNumber || 'DDC 800')}${item.accessionNumber ? ` · ${escapeHtml(item.accessionNumber)}` : ''}
        </div>
        ${codeVisual}
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;color:#0f172a;margin-top:3px;letter-spacing:0.06em;">
          ${escapeHtml(item.code)}
        </div>
        ${
          item.shelfLocation
            ? `<div style="font-size:8px;color:#64748b;margin-top:2px;">${escapeHtml(item.shelfLocation)}</div>`
            : ''
        }
        ${
          item.isReferenceOnly
            ? `<div style="display:inline-block;margin-top:3px;background:#f59e0b;color:#fff;font-size:8px;font-weight:800;padding:1px 6px;border-radius:4px;">REFERENCE ONLY</div>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  const html = `
    <div style="padding:10px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #047857;padding-bottom:6px;margin-bottom:12px;">
        <strong style="font-size:13px;color:#0f172a;">${escapeHtml(sheetTitle)}</strong>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;">${items.length} label(s) · ${new Date().toISOString().split('T')[0]}</span>
      </div>
      <div class="a4-sticker-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${cardsHtml}
      </div>
    </div>
  `;

  mountAndPrintSheet(html);
}

/**
 * Convenience helper to expand books (and their physical BookCopy records) into sticker items.
 */
export function buildStickerItemsFromBooks(books: Book[]): PrintableStickerItem[] {
  const items: PrintableStickerItem[] = [];
  for (const b of books) {
    if (b.copies && b.copies.length > 0) {
      for (const c of b.copies) {
        items.push({
          title: b.title,
          code: c.barcode,
          ddcCallNumber: b.ddcCallNumber,
          shelfLocation: c.rackLocation || c.shelfLocation || b.shelfLocation,
          accessionNumber: c.accessionNumber,
          isReferenceOnly: b.isReferenceOnly,
        });
      }
    } else {
      items.push({
        title: b.title,
        code: b.barcode,
        ddcCallNumber: b.ddcCallNumber,
        shelfLocation: b.shelfLocation,
        isReferenceOnly: b.isReferenceOnly,
      });
    }
  }
  return items;
}

/**
 * Prints 2-up A4 Patron Library ID Cards with Code-128 & optional QR barcodes without opening popups.
 */
export function printMemberIdCards(members: UserProfile[], includeQr = true) {
  if (!members || members.length === 0) return;

  const cardsHtml = members
    .map((m) => {
      const code = m.studentIdCode || m.staffIdCode || `MAG-${m.id.slice(-6).toUpperCase()}`;
      const tier = (m.patronTier || m.role).toUpperCase();
      const initials = (m.name || 'P').split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
      return `
        <div style="border:1.5px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#ffffff;break-inside:avoid;page-break-inside:avoid;">
          <div style="background:#0f172a;color:#ffffff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#34d399;font-weight:800;">F. Magoodhoo School</div>
              <div style="font-size:12px;font-weight:900;">LIBRARY PATRON PASS</div>
            </div>
            <span style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;background:#047857;color:#fff;padding:2px 8px;border-radius:6px;">
              ${escapeHtml(tier)}
            </span>
          </div>
          <div style="padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:42px;height:42px;border-radius:10px;background:#e2e8f0;color:#0f172a;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                ${m.photoUrl ? `<img src="${escapeHtml(m.photoUrl)}" style="width:100%;height:100%;object-fit:cover;" />` : escapeHtml(initials)}
              </div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:13px;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
                ${m.dhivehiName ? `<div style="font-family:'Faruma',sans-serif;font-size:11px;color:#334155;">${escapeHtml(m.dhivehiName)}</div>` : ''}
                <div style="font-size:10px;color:#64748b;">
                  ${escapeHtml(m.grade || m.staffDepartment || 'School Patron')} · ${escapeHtml(m.email)}
                </div>
              </div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;display:flex;align-items:center;gap:10px;">
              <div style="flex:1;min-width:0;text-align:center;">
                ${renderCode128SvgString(code, 36)}
                <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;color:#0f172a;margin-top:4px;letter-spacing:0.08em;">
                  ${escapeHtml(code)}
                </div>
              </div>
              ${includeQr ? `<div style="flex-shrink:0;">${renderQrSvgString(code, 44)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <div style="padding:12px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:6px;margin-bottom:14px;">
        <strong style="font-size:13px;color:#0f172a;">F. Magoodhoo School Library — Patron ID Cards</strong>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;">${members.length} card(s) · ${new Date().toISOString().split('T')[0]}</span>
      </div>
      <div class="id-card-print-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
        ${cardsHtml}
      </div>
    </div>
  `;

  mountAndPrintSheet(html);
}

/**
 * Generates a print-ready A4 Monthly Financial Reconciliation PDF report via native browser print portal.
 */
export function printMonthlyReconciliationReport(params: {
  monthLabel: string;
  summary: { unpaidMvr: number; collectedMvr: number; waivedMvr: number };
  transactions: LedgerTransaction[];
  outstandingLoans: Loan[];
}) {
  const { monthLabel, summary, transactions, outstandingLoans } = params;

  const txRows = transactions
    .map(
      (tx) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:'JetBrains Mono',monospace;">${escapeHtml(tx.date)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;">${escapeHtml(tx.userName)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(tx.bookTitle)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;font-size:10px;font-weight:700;">${escapeHtml(tx.type.replace('_', ' '))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;">MVR ${(tx.amountMvr || 0).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#475569;">${escapeHtml(tx.notes || '—')}</td>
      </tr>`
    )
    .join('');

  const unpaidRows = outstandingLoans
    .map((l) => {
      const remaining = Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0));
      return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;">${escapeHtml(l.userName)} (${escapeHtml(l.userGrade || 'Patron')})</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(l.bookTitle)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:'JetBrains Mono',monospace;">${escapeHtml(l.dueDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;color:#dc2626;">MVR ${remaining.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const html = `
    <div style="padding:18px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #047857;padding-bottom:10px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:0.08em;">F. Magoodhoo School Library</div>
          <h1 style="font-size:18px;font-weight:900;margin:2px 0 0;">Monthly MVR Fine & Financial Reconciliation</h1>
        </div>
        <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;">
          <div>Period: ${escapeHtml(monthLabel)}</div>
          <div>Generated: ${new Date().toISOString().split('T')[0]}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;">Outstanding Unpaid</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">MVR ${summary.unpaidMvr.toFixed(2)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#047857;font-weight:700;text-transform:uppercase;">Collected Revenue</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">MVR ${summary.collectedMvr.toFixed(2)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#d97706;font-weight:700;text-transform:uppercase;">Waived Exemptions</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">MVR ${summary.waivedMvr.toFixed(2)}</div>
        </div>
      </div>

      <h2 style="font-size:13px;font-weight:800;margin:12px 0 6px;">Ledger Transactions (${transactions.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1.5px solid #cbd5e1;text-align:left;font-size:10px;text-transform:uppercase;">
            <th style="padding:6px 8px;">Date</th>
            <th style="padding:6px 8px;">Patron</th>
            <th style="padding:6px 8px;">Title</th>
            <th style="padding:6px 8px;">Type</th>
            <th style="padding:6px 8px;text-align:right;">Amount</th>
            <th style="padding:6px 8px;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${txRows || `<tr><td colspan="6" style="padding:10px;text-align:center;color:#64748b;">No transactions recorded in selected period.</td></tr>`}
        </tbody>
      </table>

      <h2 style="font-size:13px;font-weight:800;margin:12px 0 6px;">Active Unpaid Accounts (${outstandingLoans.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1.5px solid #cbd5e1;text-align:left;font-size:10px;text-transform:uppercase;">
            <th style="padding:6px 8px;">Patron</th>
            <th style="padding:6px 8px;">Book Title</th>
            <th style="padding:6px 8px;">Due Date</th>
            <th style="padding:6px 8px;text-align:right;">Balance Due</th>
          </tr>
        </thead>
        <tbody>
          ${unpaidRows || `<tr><td colspan="4" style="padding:10px;text-align:center;color:#64748b;">Zero unpaid accounts.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  mountAndPrintSheet(html);
}
