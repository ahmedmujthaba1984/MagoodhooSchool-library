import {
  Book,
  BookCopy,
  UserProfile,
  Loan,
  Reservation,
  LedgerTransaction,
  LibrarySettings,
  PersonalItem,
  MediaType,
  CopyCondition,
  CopyStatus,
} from '../types';

export type BibliographicLanguage = 'dv' | 'en' | 'ar' | 'other';

export type NormalizedMediaType =
  | 'book'
  | 'ebook'
  | 'audiobook'
  | 'periodical'
  | 'board_game'
  | 'educational_kit';

export type NormalizedCopyCondition = 'new' | 'good' | 'fair' | 'damaged' | 'lost';

export type NormalizedCopyStatus =
  | 'available'
  | 'checked_out'
  | 'reserved'
  | 'in_repair'
  | 'withdrawn';

export type NormalizedPatronRole = 'student' | 'teacher' | 'staff' | 'personal_user';
export type NormalizedPatronStatus = 'active' | 'suspended' | 'graduated';
export type NormalizedLoanStatus = 'active' | 'overdue' | 'returned';
export type NormalizedHoldStatus =
  | 'pending'
  | 'ready_for_pickup'
  | 'fulfilled'
  | 'expired'
  | 'cancelled';

export type FinancialLedgerEntryType =
  | 'fine_accrued'
  | 'payment_received'
  | 'fee_waived'
  | 'lost_item_charge';

/**
 * 1. BibliographicTitle (MARC / OPAC Master Title)
 */
export interface BibliographicTitle {
  id: string;
  isbn13: string;
  upc?: string;
  title_en: string;
  title_dv: string;
  subtitle?: string;
  authors: string[];
  publisher: string;
  publication_year: number;
  language: BibliographicLanguage;
  media_type: NormalizedMediaType;
  ddc_code: string;
  subjects: string[];
  reading_level_grade: string;
  cover_url: string;
  synopsis_en: string;
  synopsis_dv: string;
  is_personal_item: boolean;
  owner_id: string | null;
  is_reference_only?: boolean;
  page_count?: number;
  created_at?: string;
}

/**
 * 2. PhysicalCopy (Parent-Child Barcode Inventory)
 */
export interface PhysicalCopy {
  copy_id: string;
  title_id: string;
  barcode: string;
  accession_number: string;
  shelf_location: string;
  condition: NormalizedCopyCondition;
  acquisition_source: string;
  replacement_cost_mvr: number;
  status: NormalizedCopyStatus;
  current_loan_id?: string | null;
  acquired_at?: string;
}

/**
 * 3. Patron (Borrower Directory)
 */
export interface Patron {
  patron_id: string;
  barcode_id: string;
  full_name_en: string;
  full_name_dv: string;
  role: NormalizedPatronRole;
  grade_class: string;
  contact_phone: string;
  email: string;
  status: NormalizedPatronStatus;
  fine_balance_mvr: number;
  parent_id?: string | null;
  children_ids?: string[];
  created_at?: string;
}

/**
 * 4. CirculationPolicy (Koha-style Role Matrix)
 */
export interface CirculationPolicy {
  role: NormalizedPatronRole;
  max_loans: number;
  loan_duration_days: number;
  max_renewals: number;
  daily_fine_mvr: number;
  max_fine_cap_mvr: number;
  grace_period_days: number;
  allow_reference_checkout?: boolean;
}

/**
 * 5. LoanTransaction (Circulation Audit Trail)
 */
export interface LoanTransaction {
  loan_id: string;
  copy_id: string;
  title_id: string;
  copy_barcode: string;
  patron_id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  renewal_count: number;
  status: NormalizedLoanStatus;
  accrued_fine_mvr: number;
  paid_fine_mvr: number;
  waived_fine_mvr: number;
  processed_by: string;
  offline_synced: boolean;
  version: number;
}

/**
 * 6. HoldReservation (OPAC Queue)
 */
export interface HoldReservation {
  reservation_id: string;
  title_id: string;
  copy_id: string | null;
  patron_id: string;
  requested_at: string;
  expires_at: string;
  queue_position: number;
  status: NormalizedHoldStatus;
  notes?: string;
}

/**
 * 7. FinancialLedgerEntry (MVR Ledger)
 */
export interface FinancialLedgerEntry {
  entry_id: string;
  patron_id: string;
  loan_id: string | null;
  type: FinancialLedgerEntryType;
  amount_mvr: number;
  reason_note: string;
  processed_by: string;
  timestamp: string;
}

/**
 * 8. Offline Outbox & Conflict Resolution Records
 */
export type OfflineOutboxActionType =
  | 'checkout'
  | 'checkin'
  | 'renew'
  | 'reserve'
  | 'cancel_hold'
  | 'fine_payment'
  | 'fee_waiver';

export interface OfflineOutboxEntry {
  outbox_id: string;
  idempotency_key: string;
  action: OfflineOutboxActionType;
  endpoint: string;
  payload: Record<string, any>;
  client_timestamp: string;
  base_version: number;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  attempts: number;
  last_error?: string;
}

export interface SyncConflictRecord {
  conflict_id: string;
  outbox_id: string;
  action: OfflineOutboxActionType;
  conflict_type:
    | 'copy_already_checked_out'
    | 'loan_already_returned'
    | 'hold_conflict'
    | 'policy_violation'
    | 'not_found';
  resolution_strategy: 'server_wins_reconciled' | 'queued_for_review' | 'idempotent_deduped';
  local_payload: Record<string, any>;
  server_reason: string;
  detected_at: string;
  resolved: boolean;
}

export interface NormalizedLibrarySnapshot {
  titles: BibliographicTitle[];
  copies: PhysicalCopy[];
  patrons: Patron[];
  policies: CirculationPolicy[];
  loans: LoanTransaction[];
  holds: HoldReservation[];
  ledger: FinancialLedgerEntry[];
}

// ---------------------------------------------------------------------------
// Deterministic Normalization Adapters (Legacy <-> Koha Relational Schema)
// ---------------------------------------------------------------------------

export function normalizeLanguage(lang?: string): BibliographicLanguage {
  const clean = (lang || '').toLowerCase();
  if (clean === 'dv' || clean === 'dhivehi') return 'dv';
  if (clean === 'ar' || clean === 'arabic') return 'ar';
  if (clean === 'en' || clean === 'english') return 'en';
  return 'other';
}

export function denormalizeLanguage(lang: BibliographicLanguage): Book['bookLanguage'] {
  if (lang === 'dv') return 'Dhivehi';
  if (lang === 'ar') return 'Arabic';
  if (lang === 'en') return 'English';
  return 'Other';
}

export function normalizeMediaType(mediaType?: MediaType): NormalizedMediaType {
  switch (mediaType) {
    case 'E-Book':
      return 'ebook';
    case 'Audiobook':
      return 'audiobook';
    case 'Periodical':
      return 'periodical';
    case 'Board Game':
      return 'board_game';
    case 'Educational Kit':
    case 'Video/DVD':
      return 'educational_kit';
    default:
      return 'book';
  }
}

export function denormalizeMediaType(mediaType: NormalizedMediaType): MediaType {
  switch (mediaType) {
    case 'ebook':
      return 'E-Book';
    case 'audiobook':
      return 'Audiobook';
    case 'periodical':
      return 'Periodical';
    case 'board_game':
      return 'Board Game';
    case 'educational_kit':
      return 'Educational Kit';
    default:
      return 'Book';
  }
}

export function normalizeCopyCondition(cond?: CopyCondition): NormalizedCopyCondition {
  switch (cond) {
    case 'New':
      return 'new';
    case 'Fair':
      return 'fair';
    case 'Damaged':
      return 'damaged';
    case 'Lost':
      return 'lost';
    default:
      return 'good';
  }
}

export function normalizeCopyStatus(status?: CopyStatus): NormalizedCopyStatus {
  switch (status) {
    case 'Checked Out':
      return 'checked_out';
    case 'Reserved':
      return 'reserved';
    case 'Maintenance':
      return 'in_repair';
    case 'Lost':
      return 'withdrawn';
    default:
      return 'available';
  }
}

export function normalizePatronRole(user: Pick<UserProfile, 'role' | 'patronTier'>): NormalizedPatronRole {
  if (user.patronTier === 'teacher') return 'teacher';
  if (user.role === 'staff' || user.role === 'admin' || user.patronTier === 'staff') return 'staff';
  if (user.role === 'student' || user.patronTier === 'student') return 'student';
  return 'personal_user';
}

export function toBibliographicTitle(book: Book): BibliographicTitle {
  const hasThaana = /[\u0780-\u07BF]/.test(book.title);
  const parenMatch = book.title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const titleDv = hasThaana
    ? parenMatch
      ? parenMatch[1].trim()
      : book.title
    : book.titleDv || book.title;
  const titleEn = hasThaana
    ? parenMatch
      ? parenMatch[2].trim()
      : book.titleEn || book.title
    : book.title;

  return {
    id: book.id,
    isbn13: book.isbn,
    upc: book.barcode && book.barcode !== book.isbn ? book.barcode : undefined,
    title_en: titleEn,
    title_dv: titleDv,
    authors: book.author
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
    publisher: book.publisher || 'School Press',
    publication_year: book.publicationYear || new Date().getFullYear(),
    language: normalizeLanguage(book.bookLanguage),
    media_type: normalizeMediaType(book.mediaType),
    ddc_code: book.ddcCallNumber || 'DDC 000',
    subjects: book.tags && book.tags.length > 0 ? book.tags : [book.category],
    reading_level_grade: book.targetGrade || 'All Ages',
    cover_url: book.coverUrl || '/covers/classic_literature.jpg',
    synopsis_en: book.description || '',
    synopsis_dv: book.descriptionDv || book.description || '',
    is_personal_item: false,
    owner_id: null,
    is_reference_only: book.isReferenceOnly,
    page_count: book.pageCount,
    created_at: book.addedAt,
  };
}

export function personalItemToBibliographicTitle(item: PersonalItem): BibliographicTitle {
  return {
    id: item.id,
    isbn13: item.isbn || '',
    upc: item.upc,
    title_en: item.title,
    title_dv: item.title,
    authors: item.author ? [item.author] : ['Unknown Author'],
    publisher: item.publisher || 'Personal Collection',
    publication_year: item.publicationYear || new Date().getFullYear(),
    language: normalizeLanguage(item.language),
    media_type: normalizeMediaType(item.mediaType),
    ddc_code: item.ddcCallNumber || 'DDC 000',
    subjects: item.tags && item.tags.length > 0 ? item.tags : [item.shelfGroup],
    reading_level_grade: 'Personal Shelf',
    cover_url: item.coverUrl || '/covers/classic_literature.jpg',
    synopsis_en: item.description || item.privateNotes || '',
    synopsis_dv: item.description || item.privateNotes || '',
    is_personal_item: true,
    owner_id: item.ownerId,
    page_count: item.pageCount,
    created_at: item.addedAt,
  };
}

export function toPhysicalCopies(book: Book): PhysicalCopy[] {
  if (Array.isArray(book.copies) && book.copies.length > 0) {
    return book.copies.map((copy: BookCopy, idx: number) => ({
      copy_id: copy.copyId,
      title_id: book.id,
      barcode: copy.barcode,
      accession_number: copy.accessionNumber || `ACC-${book.id.toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
      shelf_location: copy.shelfLocation || book.shelfLocation,
      condition: normalizeCopyCondition(copy.condition),
      acquisition_source: 'School Library Acquisition',
      replacement_cost_mvr: copy.acquisitionPriceMvr || 150,
      status: normalizeCopyStatus(copy.status),
      current_loan_id: copy.currentLoanId || null,
      acquired_at: copy.acquiredAt || book.addedAt,
    }));
  }

  const copies: PhysicalCopy[] = [];
  const total = Math.max(1, book.totalCopies || 1);
  for (let i = 1; i <= total; i++) {
    copies.push({
      copy_id: `${book.id}-copy-${i}`,
      title_id: book.id,
      barcode: i === 1 ? book.barcode : `${book.barcode}-${String(i).padStart(2, '0')}`,
      accession_number: `ACC-${book.id.replace(/[^0-9]/g, '').padStart(3, '0')}${String(i).padStart(2, '0')}`,
      shelf_location: book.shelfLocation,
      condition: 'good',
      acquisition_source: 'Magoodhoo School Procurement',
      replacement_cost_mvr: 150,
      status: i <= book.availableCopies ? 'available' : 'checked_out',
      current_loan_id: null,
      acquired_at: book.addedAt,
    });
  }
  return copies;
}

export function toPatron(user: UserProfile, fineBalanceMvr = 0): Patron {
  return {
    patron_id: user.id,
    barcode_id: user.studentIdCode || user.staffIdCode || user.id.toUpperCase(),
    full_name_en: user.name,
    full_name_dv: user.dhivehiName || user.name,
    role: normalizePatronRole(user),
    grade_class: user.grade || user.staffDepartment || (user.role === 'parent' ? 'Guardian / Parent' : 'General'),
    contact_phone: user.phone || '+960 000-0000',
    email: user.email,
    status: 'active',
    fine_balance_mvr: Number(fineBalanceMvr.toFixed(2)),
    parent_id: user.parentId || null,
    children_ids: user.childrenIds || [],
    created_at: user.createdAt,
  };
}

export function toCirculationPolicies(settings: LibrarySettings): CirculationPolicy[] {
  const maxFineCap = settings.maxOverdueFineCap ?? 100;
  const rules = settings.patronTierRules;
  if (rules) {
    const roles: Array<{ key: 'student' | 'teacher' | 'staff' | 'external'; role: NormalizedPatronRole }> = [
      { key: 'student', role: 'student' },
      { key: 'teacher', role: 'teacher' },
      { key: 'staff', role: 'staff' },
      { key: 'external', role: 'personal_user' },
    ];
    return roles.map(({ key, role }) => {
      const r = rules[key];
      return {
        role,
        max_loans: r.maxBooks,
        loan_duration_days: r.loanDays,
        max_renewals: r.maxRenewals,
        daily_fine_mvr: r.dailyFineMvr,
        max_fine_cap_mvr: maxFineCap,
        grace_period_days: r.graceDays,
        allow_reference_checkout: r.allowReferenceCheckout,
      };
    });
  }

  return [
    {
      role: 'student',
      max_loans: settings.maxBooksPerStudent || 3,
      loan_duration_days: settings.maxBorrowDays || 14,
      max_renewals: settings.maxRenewals || 2,
      daily_fine_mvr: settings.lateFeePerDay || 2.0,
      max_fine_cap_mvr: maxFineCap,
      grace_period_days: settings.gracePeriodDays || 2,
      allow_reference_checkout: false,
    },
    {
      role: 'teacher',
      max_loans: 8,
      loan_duration_days: settings.staffBorrowDays || 30,
      max_renewals: 3,
      daily_fine_mvr: 1.0,
      max_fine_cap_mvr: maxFineCap,
      grace_period_days: 5,
      allow_reference_checkout: true,
    },
    {
      role: 'staff',
      max_loans: settings.maxBooksPerStaff || 7,
      loan_duration_days: settings.staffBorrowDays || 30,
      max_renewals: 3,
      daily_fine_mvr: 1.0,
      max_fine_cap_mvr: maxFineCap,
      grace_period_days: 5,
      allow_reference_checkout: settings.allowReferenceCheckoutForStaff,
    },
    {
      role: 'personal_user',
      max_loans: 2,
      loan_duration_days: 10,
      max_renewals: 1,
      daily_fine_mvr: 3.0,
      max_fine_cap_mvr: maxFineCap,
      grace_period_days: 1,
      allow_reference_checkout: false,
    },
  ];
}

export function toLoanTransaction(loan: Loan, copies: PhysicalCopy[] = []): LoanTransaction {
  const matchedCopy = copies.find(
    (c) =>
      (loan.copyBarcode && c.barcode === loan.copyBarcode) ||
      c.current_loan_id === loan.id ||
      c.title_id === loan.bookId
  );

  return {
    loan_id: loan.id,
    copy_id: matchedCopy?.copy_id || `${loan.bookId}-copy-1`,
    title_id: loan.bookId,
    copy_barcode: loan.copyBarcode || matchedCopy?.barcode || loan.bookIsbn,
    patron_id: loan.userId,
    issue_date: loan.issueDate,
    due_date: loan.dueDate,
    return_date: loan.returnDate || null,
    renewal_count: loan.renewalCount || 0,
    status: loan.status,
    accrued_fine_mvr: loan.lateFee || 0,
    paid_fine_mvr: loan.amountPaid || (loan.feePaid ? loan.lateFee || 0 : 0),
    waived_fine_mvr: loan.waivedReason ? loan.lateFee || 0 : 0,
    processed_by: loan.processedBy || 'Circulation Desk',
    offline_synced: true,
    version: 1,
  };
}

export function toHoldReservation(res: Reservation, queuePosition = 1, holdExpiryDays = 3): HoldReservation {
  const reqDate = new Date(res.requestDate || Date.now());
  const expDate = new Date(reqDate.getTime() + holdExpiryDays * 86400000);
  return {
    reservation_id: res.id,
    title_id: res.bookId,
    copy_id: null,
    patron_id: res.userId,
    requested_at: res.requestDate,
    expires_at: expDate.toISOString().split('T')[0],
    queue_position: queuePosition,
    status: res.status,
    notes: res.notes,
  };
}

export function toFinancialLedgerEntry(tx: LedgerTransaction): FinancialLedgerEntry {
  const mapType = (t: LedgerTransaction['type']): FinancialLedgerEntryType => {
    switch (t) {
      case 'fine_accrual':
        return 'fine_accrued';
      case 'payment':
      case 'partial_payment':
        return 'payment_received';
      case 'waiver':
        return 'fee_waived';
      case 'lost_replacement':
        return 'lost_item_charge';
    }
  };

  return {
    entry_id: tx.id,
    patron_id: tx.userId,
    loan_id: tx.loanId || null,
    type: mapType(tx.type),
    amount_mvr: tx.amountMvr,
    reason_note: tx.notes || tx.bookTitle,
    processed_by: tx.processedBy,
    timestamp: tx.date.includes('T') ? tx.date : `${tx.date}T08:00:00.000Z`,
  };
}

export function buildNormalizedSnapshot(params: {
  books: Book[];
  personalItems?: PersonalItem[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  ledgerTransactions: LedgerTransaction[];
  settings: LibrarySettings;
}): NormalizedLibrarySnapshot {
  const titles = [
    ...params.books.map(toBibliographicTitle),
    ...(params.personalItems || []).map(personalItemToBibliographicTitle),
  ];
  const copies = params.books.flatMap(toPhysicalCopies);

  const fineByPatron = new Map<string, number>();
  for (const loan of params.loans) {
    if (!loan.feePaid && (loan.lateFee || 0) > 0) {
      const owed = Math.max(0, (loan.lateFee || 0) - (loan.amountPaid || 0));
      fineByPatron.set(loan.userId, (fineByPatron.get(loan.userId) || 0) + owed);
    }
  }

  const patrons = params.users.map((u) => toPatron(u, fineByPatron.get(u.id) || 0));
  const policies = toCirculationPolicies(params.settings);
  const loans = params.loans.map((l) => toLoanTransaction(l, copies));

  const titleQueueCounters = new Map<string, number>();
  const holds = params.reservations.map((r) => {
    const nextPos = (titleQueueCounters.get(r.bookId) || 0) + 1;
    titleQueueCounters.set(r.bookId, nextPos);
    return toHoldReservation(r, nextPos, params.settings.holdExpiryDays || 3);
  });

  const ledger = params.ledgerTransactions.map(toFinancialLedgerEntry);

  return {
    titles,
    copies,
    patrons,
    policies,
    loans,
    holds,
    ledger,
  };
}
