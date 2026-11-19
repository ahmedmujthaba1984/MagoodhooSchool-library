import {
  Book,
  LibrarySettings,
  Loan,
  OfflineOutboxActionType,
  Reservation,
  UserProfile,
} from '../types';
import {
  calculateSchoolDueDate,
  DEFAULT_MALDIVES_SCHOOL_HOLIDAYS,
  isSchoolWorkingDay,
  resolvePatronCirculationPolicy,
} from '../lib/schoolCalendar';
import {
  createLoan as firestoreCreateLoan,
  updateLoan as firestoreUpdateLoan,
  createReservation as firestoreCreateReservation,
  updateReservation as firestoreUpdateReservation,
  cancelReservation as firestoreCancelReservation,
  subscribeLoans,
  subscribeReservations,
} from '../lib/firebase';
import { offlineSyncEngine } from '../lib/offlineSyncEngine';

export interface CheckoutEligibilityResult {
  allowed: boolean;
  reason?: string;
  reasonDv?: string;
  activeLoanCount: number;
  maxLoansAllowed: number;
  unpaidFineMvr: number;
  computedDueDate: string;
}

export interface RenewalEligibilityResult {
  allowed: boolean;
  reason?: string;
  reasonDv?: string;
  nextDueDate?: string;
  remainingRenewals: number;
}

export const circulationService = {
  // Real-time Subscriptions & Persistence
  subscribeLoans,
  subscribeReservations,
  createLoan: firestoreCreateLoan,
  updateLoan: firestoreUpdateLoan,
  createReservation: firestoreCreateReservation,
  updateReservation: firestoreUpdateReservation,
  cancelReservation: firestoreCancelReservation,

  // Maldives School Calendar (Sun–Thu) helpers
  isSchoolWorkingDay,
  calculateDueDateForPatron(
    patron: Pick<UserProfile, 'role' | 'patronTier'> | null | undefined,
    settings: LibrarySettings,
    startDate: Date = new Date()
  ): string {
    const policy = resolvePatronCirculationPolicy(patron, settings);
    const holidays = settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS;
    return calculateSchoolDueDate(startDate, policy.loanDays, holidays);
  },

  resolvePolicy: resolvePatronCirculationPolicy,

  /**
   * Evaluates Koha-style circulation rules before issuing a copy:
   * copy availability, reference-only permissions, active loan limit, and unpaid fine block threshold.
   */
  evaluateCheckoutEligibility(params: {
    book: Book;
    patron: UserProfile;
    loans: Loan[];
    reservations: Reservation[];
    settings: LibrarySettings;
  }): CheckoutEligibilityResult {
    const { book, patron, loans, reservations, settings } = params;
    const policy = resolvePatronCirculationPolicy(patron, settings);
    const computedDueDate = this.calculateDueDateForPatron(patron, settings);

    const patronActiveLoans = loans.filter(
      (l) => l.userId === patron.id && l.status !== 'returned'
    );
    const unpaidFineMvr = loans
      .filter((l) => l.userId === patron.id && !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);

    if (book.isReferenceOnly && !policy.allowReferenceCheckout) {
      return {
        allowed: false,
        reason: 'This title is Reference Only (In-Library Use).',
        reasonDv: 'މިއީ ލައިބްރަރީގައި އެކަނި ކިޔުމަށް ޚާއްޞަ ރެފަރެންސް ފޮތެކެވެ.',
        activeLoanCount: patronActiveLoans.length,
        maxLoansAllowed: policy.maxBooks,
        unpaidFineMvr,
        computedDueDate,
      };
    }

    if ((book.availableCopies ?? 0) <= 0) {
      return {
        allowed: false,
        reason: 'All physical copies are currently checked out. Place a hold reservation instead.',
        reasonDv: 'މި ފޮތުގެ ހުރިހާ ކޮޕީއެއް މިވަގުތު ވަނީ ދޫކުރެވިފައެވެ. ރިޒާވް ކުރައްވާށެވެ.',
        activeLoanCount: patronActiveLoans.length,
        maxLoansAllowed: policy.maxBooks,
        unpaidFineMvr,
        computedDueDate,
      };
    }

    if (patronActiveLoans.length >= policy.maxBooks) {
      return {
        allowed: false,
        reason: `Borrowing limit reached (${patronActiveLoans.length}/${policy.maxBooks} active loans).`,
        reasonDv: `ފޮތް ގެންދެވޭ ޙައްދު (${patronActiveLoans.length}/${policy.maxBooks}) ހަމަވެއްޖެއެވެ.`,
        activeLoanCount: patronActiveLoans.length,
        maxLoansAllowed: policy.maxBooks,
        unpaidFineMvr,
        computedDueDate,
      };
    }

    const blockThreshold = settings.blockBorrowingFineThreshold ?? 50;
    if (blockThreshold > 0 && unpaidFineMvr >= blockThreshold) {
      return {
        allowed: false,
        reason: `Borrowing blocked: unpaid balance MVR ${unpaidFineMvr.toFixed(2)} exceeds limit (MVR ${blockThreshold.toFixed(2)}).`,
        reasonDv: `ޖޫރިމަނާ MVR ${unpaidFineMvr.toFixed(2)} ދެއްކެވުމަށްފަހު ފޮތް ދޫކުރެވޭނެއެވެ.`,
        activeLoanCount: patronActiveLoans.length,
        maxLoansAllowed: policy.maxBooks,
        unpaidFineMvr,
        computedDueDate,
      };
    }

    const activeHoldByOther = reservations.find(
      (r) => r.bookId === book.id && r.status === 'pending' && r.userId !== patron.id
    );
    if (activeHoldByOther && (book.availableCopies ?? 0) <= 1) {
      return {
        allowed: false,
        reason: `Last shelf copy is reserved on hold for ${activeHoldByOther.userName}.`,
        reasonDv: `ބާކީ ހުރި ކޮޕީ ވަނީ ${activeHoldByOther.userName} އަށް ރިޒާވް ކުރެވިފައެވެ.`,
        activeLoanCount: patronActiveLoans.length,
        maxLoansAllowed: policy.maxBooks,
        unpaidFineMvr,
        computedDueDate,
      };
    }

    return {
      allowed: true,
      activeLoanCount: patronActiveLoans.length,
      maxLoansAllowed: policy.maxBooks,
      unpaidFineMvr,
      computedDueDate,
    };
  },

  /**
   * Evaluates whether an active loan can be renewed, blocking renewals if
   * another patron holds a pending reservation on the title.
   */
  evaluateRenewalEligibility(params: {
    loan: Loan;
    patron?: UserProfile | null;
    reservations: Reservation[];
    settings: LibrarySettings;
  }): RenewalEligibilityResult {
    const { loan, patron, reservations, settings } = params;
    const policy = resolvePatronCirculationPolicy(patron, settings);
    const remainingRenewals = Math.max(0, policy.maxRenewals - (loan.renewalCount || 0));

    if (loan.status === 'returned') {
      return {
        allowed: false,
        reason: 'Returned loans cannot be renewed.',
        reasonDv: 'އަނބުރާ ދީފައިވާ ފޮތެއް މުއްދަތު އިތުރެއް ނުކުރެވޭނެއެވެ.',
        remainingRenewals: 0,
      };
    }

    if (remainingRenewals <= 0) {
      return {
        allowed: false,
        reason: `Maximum renewals reached (${policy.maxRenewals}/${policy.maxRenewals}).`,
        reasonDv: `މުއްދަތު އިތުރުކުރެވޭ އެންމެ ގިނަ އަދަދު (${policy.maxRenewals}) ހަމަވެއްޖެއެވެ.`,
        remainingRenewals: 0,
      };
    }

    const conflictingHold = reservations.find(
      (r) => r.bookId === loan.bookId && r.status === 'pending' && r.userId !== loan.userId
    );
    if (conflictingHold) {
      return {
        allowed: false,
        reason: `Cannot renew: another patron (${conflictingHold.userName}) has an active hold.`,
        reasonDv: `މުއްދަތު އިތުރުނުކުރެވުނު: އެހެން މެންބަރަކު މި ފޮތް ރިޒާވް ކޮށްފައިވެއެވެ.`,
        remainingRenewals,
      };
    }

    const baseDate = new Date();
    const holidays = settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS;
    const nextDueDate = calculateSchoolDueDate(
      baseDate,
      Math.max(5, Math.round(policy.loanDays / 2)),
      holidays
    );

    return {
      allowed: true,
      nextDueDate,
      remainingRenewals: remainingRenewals - 1,
    };
  },

  /**
   * Queues an offline circulation action into the IndexedDB outbox for FIFO sync on reconnect.
   */
  async queueOfflineAction(
    action: OfflineOutboxActionType,
    endpoint: string,
    payload: Record<string, any>
  ) {
    return offlineSyncEngine.enqueueOperation({ action, endpoint, payload });
  },

  async syncOfflineOutbox() {
    return offlineSyncEngine.flushOutbox();
  },
};
