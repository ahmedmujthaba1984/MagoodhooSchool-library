import {
  AcquisitionBudgetCategory,
  AcquisitionRequest,
  Book,
  BookCopy
} from '../types';
import { defaultAcquisitionsBudgetsMvr } from '../data/seedData';

export const BUDGET_CATEGORIES: AcquisitionBudgetCategory[] = [
  'Dhivehi Literature',
  'STEM & Technology',
  'Reference & Atlases',
  'Islamic Studies',
  'Fiction & Graded Readers',
];

export const BUDGET_CATEGORY_DV: Record<AcquisitionBudgetCategory, string> = {
  'Dhivehi Literature': 'ދިވެހި އަދަބިއްޔާތު',
  'STEM & Technology': 'ސައިންސް އަދި ޓެކްނޮލޮޖީ',
  'Reference & Atlases': 'ރެފަރެންސް އަދި އެޓްލަސް',
  'Islamic Studies': 'އިސްލާމީ ތަރުބިއްޔަތު',
  'Fiction & Graded Readers': 'ވާހަކަ އަދި ކިޔުމުގެ ފޮތް',
};

export interface CategoryBudgetSummary {
  category: AcquisitionBudgetCategory;
  labelDv: string;
  allocatedMvr: number;
  spentMvr: number;
  committedMvr: number;
  remainingMvr: number;
  utilizationPct: number;
  itemCount: number;
  donatedCopies: number;
}

export interface AcquisitionsBudgetOverview {
  totalAllocatedMvr: number;
  totalSpentMvr: number;
  totalCommittedMvr: number;
  totalRemainingMvr: number;
  overallUtilizationPct: number;
  donatedTitlesCount: number;
  donatedCopiesCount: number;
  categories: CategoryBudgetSummary[];
}

export function getLineTotalMvr(req: Pick<AcquisitionRequest, 'quantity' | 'unitPriceMvr' | 'isDonation'>): number {
  if (req.isDonation) return 0;
  const qty = Math.max(1, Number(req.quantity) || 1);
  const price = Math.max(0, Number(req.unitPriceMvr) || 0);
  return Number((qty * price).toFixed(2));
}

export function computeCategoryBudgets(
  requests: AcquisitionRequest[],
  customAllocations?: Record<string, number>
): AcquisitionsBudgetOverview {
  const allocations = { ...defaultAcquisitionsBudgetsMvr, ...(customAllocations || {}) };

  let totalAllocatedMvr = 0;
  let totalSpentMvr = 0;
  let totalCommittedMvr = 0;
  let donatedTitlesCount = 0;
  let donatedCopiesCount = 0;

  for (const r of requests) {
    if (r.isDonation || (r.donorName && r.donorName.trim().length > 0)) {
      donatedTitlesCount += 1;
      donatedCopiesCount += Math.max(1, Number(r.quantity) || 1);
    }
  }

  const categories: CategoryBudgetSummary[] = BUDGET_CATEGORIES.map((category) => {
    const allocated = Math.max(0, Number(allocations[category] ?? 15000));
    const catReqs = requests.filter((r) => r.budgetCategory === category);

    let spentMvr = 0;
    let committedMvr = 0;
    let donatedCopies = 0;

    for (const req of catReqs) {
      if (req.isDonation) {
        donatedCopies += Math.max(1, Number(req.quantity) || 1);
        continue;
      }
      const lineTotal = getLineTotalMvr(req);
      if (req.stage === 'Received & Cataloged') {
        spentMvr += lineTotal;
      } else if (req.stage === 'Approved' || req.stage === 'Ordered') {
        committedMvr += lineTotal;
      }
    }

    spentMvr = Number(spentMvr.toFixed(2));
    committedMvr = Number(committedMvr.toFixed(2));
    const remainingMvr = Number((allocated - spentMvr - committedMvr).toFixed(2));
    const utilizationPct = allocated > 0
      ? Math.min(100, Math.round(((spentMvr + committedMvr) / allocated) * 100))
      : 0;

    totalAllocatedMvr += allocated;
    totalSpentMvr += spentMvr;
    totalCommittedMvr += committedMvr;

    return {
      category,
      labelDv: BUDGET_CATEGORY_DV[category],
      allocatedMvr: allocated,
      spentMvr,
      committedMvr,
      remainingMvr,
      utilizationPct,
      itemCount: catReqs.length,
      donatedCopies,
    };
  });

  const totalRemainingMvr = Number((totalAllocatedMvr - totalSpentMvr - totalCommittedMvr).toFixed(2));
  const overallUtilizationPct = totalAllocatedMvr > 0
    ? Math.min(100, Math.round(((totalSpentMvr + totalCommittedMvr) / totalAllocatedMvr) * 100))
    : 0;

  return {
    totalAllocatedMvr,
    totalSpentMvr,
    totalCommittedMvr,
    totalRemainingMvr,
    overallUtilizationPct,
    donatedTitlesCount,
    donatedCopiesCount,
    categories,
  };
}

export function sortAcquisitionRequestsByPriority(requests: AcquisitionRequest[]): AcquisitionRequest[] {
  return [...requests].sort((a, b) => {
    const votesDiff = (b.upvoterIds?.length || 0) - (a.upvoterIds?.length || 0);
    if (votesDiff !== 0) return votesDiff;
    return (b.requestedDate || '').localeCompare(a.requestedDate || '');
  });
}

function getShelfMetaForCategory(category: AcquisitionBudgetCategory, language: string): {
  catalogCategory: string;
  ddcCallNumber: string;
  shelfLocation: string;
  ddcPrefix: string;
} {
  if (category === 'Dhivehi Literature' || language === 'Dhivehi') {
    return {
      catalogCategory: 'Dhivehi Literature',
      ddcCallNumber: 'DDC 891.4',
      shelfLocation: 'Shelf D1 (Dhivehi Wing)',
      ddcPrefix: '891',
    };
  }
  if (category === 'STEM & Technology') {
    return {
      catalogCategory: 'STEM & Science',
      ddcCallNumber: 'DDC 500',
      shelfLocation: 'Shelf S2 (STEM Section)',
      ddcPrefix: '500',
    };
  }
  if (category === 'Reference & Atlases') {
    return {
      catalogCategory: 'Reference',
      ddcCallNumber: 'DDC 030',
      shelfLocation: 'Reference Desk R1',
      ddcPrefix: '030',
    };
  }
  if (category === 'Islamic Studies') {
    return {
      catalogCategory: 'Islamic Studies',
      ddcCallNumber: 'DDC 297',
      shelfLocation: 'Shelf I1 (Islamic Section)',
      ddcPrefix: '297',
    };
  }
  return {
    catalogCategory: 'Fiction',
    ddcCallNumber: 'DDC 823',
    shelfLocation: 'Shelf F1 (Fiction)',
    ddcPrefix: '823',
  };
}

export function convertAcquisitionToCatalogBook(req: AcquisitionRequest): {
  bookData: Omit<Book, 'id'>;
  assignedBarcodes: string[];
} {
  const qty = Math.max(1, Number(req.quantity) || 1);
  const today = new Date().toISOString().split('T')[0];
  const meta = getShelfMetaForCategory(req.budgetCategory, req.bookLanguage);
  const titleSuffix = String(Date.now()).slice(-4);
  const primaryBarcode = `MAG-${meta.ddcPrefix}-${titleSuffix}-01`;

  const copies: BookCopy[] = Array.from({ length: qty }, (_, idx) => {
    const seq = String(idx + 1).padStart(2, '0');
    const barcode = `MAG-${meta.ddcPrefix}-${titleSuffix}-${seq}`;
    return {
      copyId: `cp-${titleSuffix}-${seq}`,
      barcode,
      accessionNumber: `ACC-2026-${titleSuffix}${seq}`,
      shelfLocation: meta.shelfLocation,
      condition: 'New',
      acquisitionPriceMvr: req.isDonation ? 0 : Math.max(0, Number(req.unitPriceMvr) || 0),
      status: 'Available',
      acquiredAt: today,
      notes: req.isDonation && req.donorName
        ? `Donated By ${req.donorName}`
        : req.invoiceNumber
        ? `Acquired via Invoice ${req.invoiceNumber}`
        : undefined,
    };
  });

  const isReference = req.budgetCategory === 'Reference & Atlases';
  const donorLine = req.isDonation && req.donorName
    ? ` Generously donated by ${req.donorName}.`
    : '';

  const bookData: Omit<Book, 'id'> = {
    title: req.title.trim(),
    author: req.author.trim() || 'Unknown Author',
    isbn: (req.isbn || '').trim() || `97899915${titleSuffix}0`,
    barcode: primaryBarcode,
    category: meta.catalogCategory,
    mediaType: 'Book',
    ddcCallNumber: meta.ddcCallNumber,
    targetGrade: 'All Ages',
    bookLanguage: req.bookLanguage || 'English',
    isReferenceOnly: isReference,
    totalCopies: qty,
    availableCopies: qty,
    shelfLocation: meta.shelfLocation,
    coverUrl:
      req.bookLanguage === 'Dhivehi'
        ? '/covers/dhivehi_heritage.jpg'
        : req.budgetCategory === 'STEM & Technology'
        ? '/covers/stem_science.jpg'
        : '/covers/classic_literature.jpg',
    description: `${req.curriculumJustification || 'Acquired for F. Magoodhoo School Library collection.'}${donorLine}`.trim(),
    publisher: req.vendorName || (req.isDonation ? 'Community Donation' : 'School Library Acquisitions'),
    publicationYear: new Date().getFullYear(),
    tags: [
      req.budgetCategory,
      ...(req.isDonation ? ['Donated', req.donorName || 'Book Drive'] : ['Acquired 2026']),
    ],
    copies,
    addedAt: today,
  };

  return {
    bookData,
    assignedBarcodes: copies.map((c) => c.barcode),
  };
}

export interface BookplateItem {
  id: string;
  title: string;
  author: string;
  donorName: string;
  isbn?: string;
  donatedDate?: string;
  quantity?: number;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBookplatesHtml(items: BookplateItem[]): string {
  const plates = items.map((item) => {
    const donor = item.donorName.trim() || 'Magoodhoo School Community';
    const dateLabel = item.donatedDate || new Date().toISOString().split('T')[0];
    return `
      <div style="border:2px solid #047857;border-radius:12px;padding:4px;background:#ffffff;break-inside:avoid;page-break-inside:avoid;">
        <div style="border:1px solid #a7f3d0;border-radius:8px;padding:16px 18px;text-align:center;position:relative;">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              <path d="M9 7h6"/>
              <path d="M9 11h4"/>
            </svg>
            <span style="font-size:10px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">
              Ex-Libris · F. Magoodhoo School Library
            </span>
          </div>

          <div style="font-family:'Faruma','Noto Sans Thaana',sans-serif;font-size:12px;font-weight:700;color:#065f46;margin-bottom:10px;" dir="rtl">
            ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީއަށް ހަދިޔާކުރެއްވީ
          </div>

          <div style="border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1;padding:10px 6px;margin-bottom:10px;background:#f8fafc;border-radius:6px;">
            <div style="font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin-bottom:3px;">
              Donated By
            </div>
            <div style="font-size:16px;font-weight:900;color:#0f172a;line-height:1.25;">
              ${escapeHtml(donor)}
            </div>
          </div>

          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:2px;">
            ${escapeHtml(item.title)}
          </div>
          <div style="font-size:10px;color:#475569;margin-bottom:8px;">
            ${escapeHtml(item.author)}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9px;color:#64748b;padding-top:6px;border-top:1px solid #e2e8f0;">
            <span>${item.isbn ? `ISBN ${escapeHtml(item.isbn)}` : 'DONATION ARCHIVE'}</span>
            <span>${escapeHtml(dateLabel)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="padding:14px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #047857;padding-bottom:8px;margin-bottom:16px;">
        <div>
          <strong style="font-size:14px;color:#0f172a;">F. Magoodhoo School Library — Inside-Cover Donation Bookplates</strong>
          <div style="font-size:11px;color:#475569;">Cut along outer border and affix to inside front cover</div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#047857;font-weight:700;">
          ${items.length} plate(s) · ${new Date().toISOString().split('T')[0]}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        ${plates}
      </div>
    </div>
  `;
}

export function printDonationBookplateLabels(items: BookplateItem[]) {
  if (!items || items.length === 0) return;
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
  container.innerHTML = buildBookplatesHtml(items);

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
