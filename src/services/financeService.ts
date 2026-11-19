import {
  Book,
  LedgerTransaction,
  LedgerTransactionType,
  LibrarySettings,
  Loan,
  UserProfile,
} from '../types';
import {
  calculatePolicyOverdueFine,
  calculateWorkingDaysOverdue,
  type PolicyFineCalculation,
} from '../lib/schoolCalendar';
import {
  buildStickerItemsFromBooks,
  printBarcodeStickerSheet,
  printMemberIdCards,
  printMonthlyReconciliationReport,
  type BarcodeLabelStyle,
} from '../lib/printableLabels';

export type { PolicyFineCalculation, BarcodeLabelStyle };

export interface PatronFineSummary {
  totalUnpaidMvr: number;
  totalPaidMvr: number;
  totalWaivedMvr: number;
  unpaidLoans: Loan[];
}

export const financeService = {
  /**
   * Computes policy-aware overdue fine in MVR, respecting Maldives Fri/Sat weekends,
   * school holidays, grace periods, and maximum fine cap.
   */
  calculateOverdueFine(params: {
    loan: Pick<Loan, 'dueDate'>;
    patron?: Pick<UserProfile, 'role' | 'patronTier'> | null;
    settings: LibrarySettings;
    returnDateStr?: string;
  }): PolicyFineCalculation {
    return calculatePolicyOverdueFine(params);
  },

  calculateWorkingDaysOverdue,

  /**
   * Computes lost or damaged book fee in MVR using copy acquisition price when available.
   */
  calculateLostOrDamagedFee(params: {
    mode: 'lost' | 'damaged';
    book?: Book | null;
    copyBarcode?: string;
    settings: LibrarySettings;
  }): number {
    const { mode, book, copyBarcode, settings } = params;
    if (mode === 'damaged') {
      return Number((settings.damagedBookMinorFee ?? 25).toFixed(2));
    }
    const matchingCopy = book?.copies?.find((c) => c.barcode === copyBarcode);
    const replacementCost =
      matchingCopy?.acquisitionPriceMvr ||
      settings.lostBookReplacementFee ||
      150;
    return Number(replacementCost.toFixed(2));
  },

  /**
   * Aggregates unpaid, paid, and waived MVR balances for a single patron or a parent's linked children.
   */
  summarizePatronFines(
    patronIds: string[],
    loans: Loan[],
    ledgerTransactions: LedgerTransaction[] = []
  ): PatronFineSummary {
    const idSet = new Set(patronIds);
    const matchingLoans = loans.filter((l) => idSet.has(l.userId));

    const unpaidLoans = matchingLoans.filter(
      (l) => !l.feePaid && Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)) > 0
    );

    const totalUnpaidMvr = Number(
      unpaidLoans
        .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0)
        .toFixed(2)
    );

    const totalPaidMvr = Number(
      matchingLoans
        .reduce((sum, l) => sum + (l.amountPaid || (l.feePaid ? l.lateFee || 0 : 0)), 0)
        .toFixed(2)
    );

    const waivedFromLoans = matchingLoans.reduce((sum, l) => sum + (l.waivedAmount || 0), 0);
    const waivedFromLedger = ledgerTransactions
      .filter((tx) => idSet.has(tx.userId) && tx.type === 'waiver')
      .reduce((sum, tx) => sum + (tx.amountMvr || 0), 0);

    return {
      totalUnpaidMvr,
      totalPaidMvr,
      totalWaivedMvr: Number(Math.max(waivedFromLoans, waivedFromLedger).toFixed(2)),
      unpaidLoans,
    };
  },

  createLedgerEntry(params: {
    userId: string;
    userName: string;
    bookTitle: string;
    type: LedgerTransactionType;
    amountMvr: number;
    processedBy: string;
    loanId?: string;
    notes?: string;
  }): LedgerTransaction {
    return {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      loanId: params.loanId,
      userId: params.userId,
      userName: params.userName,
      bookTitle: params.bookTitle,
      type: params.type,
      amountMvr: Number(params.amountMvr.toFixed(2)),
      date: new Date().toISOString().split('T')[0],
      notes: params.notes,
      processedBy: params.processedBy,
    };
  },

  formatMvr(amount: number): string {
    return `MVR ${(Number(amount) || 0).toFixed(2)}`;
  },

  // Printable A4 Sheets (iFrame-safe DOM portal print)
  printReconciliationReport: printMonthlyReconciliationReport,
  printSpineStickers(books: Book[], style: BarcodeLabelStyle = 'code128', title?: string) {
    const items = buildStickerItemsFromBooks(books);
    printBarcodeStickerSheet(items, title, style);
  },
  printPatronIdCards: printMemberIdCards,
};
