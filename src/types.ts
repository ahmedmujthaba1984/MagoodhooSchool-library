export type UserRole = 'admin' | 'student' | 'parent' | 'staff';

export type AccessRole = 'super_admin' | 'desk_assistant' | 'teacher' | 'student_guest';

export type PatronTier = 'student' | 'teacher' | 'staff' | 'parent' | 'external';

export type SchoolHouse = 'Ghaazee' | 'Bodu Thakurufaanu' | 'Dhon Bandaarain' | 'Huravee';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  dhivehiName?: string;
  gender?: string;
  role: UserRole;
  accessRole?: AccessRole;
  patronTier?: PatronTier;
  parentId?: string; // For student: parent user id
  childrenIds?: string[]; // For parent: list of student ids
  grade?: string; // e.g. "Grade 8", "Grade 5"
  schoolHouse?: SchoolHouse | string;
  studentIdCode?: string; // e.g. "STU-1029"
  staffIdCode?: string; // e.g. "STF-3012"
  staffDepartment?: string; // e.g. "Science Dept", "Administration", "Primary Faculty"
  phone?: string;
  photoUrl?: string;
  memberBarcodeUrl?: string;
  readingStreakDays?: number;
  booksCompletedCount?: number;
  earnedBadgeIds?: string[];
  createdAt?: string;
}

export type MediaType =
  | 'Book'
  | 'E-Book'
  | 'Audiobook'
  | 'Periodical'
  | 'Board Game'
  | 'Video/DVD'
  | 'Educational Kit';

export type CopyCondition = 'New' | 'Good' | 'Fair' | 'Damaged' | 'Lost';
export type CopyStatus = 'Available' | 'Checked Out' | 'Reserved' | 'Missing' | 'Lost' | 'Maintenance';

export interface BookCopy {
  copyId: string;
  barcode: string;
  accessionNumber?: string;
  rackLocation?: string;
  shelfLocation: string;
  condition: CopyCondition;
  acquisitionPriceMvr: number;
  status: CopyStatus;
  currentLoanId?: string;
  notes?: string;
  acquiredAt?: string;
}

export interface Book {
  id: string;
  title: string;
  titleEn?: string;
  titleDv?: string;
  author: string;
  isbn: string;
  barcode: string;
  barcodeImageUrl?: string;
  category: string;
  mediaType?: MediaType;
  ddcCallNumber?: string; // Dewey Decimal Classification e.g. "DDC 823.91"
  targetGrade?: string;
  bookLanguage?: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  isReferenceOnly: boolean;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string;
  coverUrl: string;
  description: string;
  descriptionDv?: string;
  publisher: string;
  publicationYear: number;
  pageCount?: number;
  tags?: string[];
  marcRecordNote?: string;
  copies?: BookCopy[];
  addedAt: string;
}

export type ReadingProgressStatus = 'To Read' | 'In Progress' | 'Completed' | 'Loaned to Friend';

export interface PersonalItem {
  id: string;
  ownerId: string;
  title: string;
  author: string;
  isbn?: string;
  upc?: string;
  mediaType: MediaType;
  language: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  coverUrl?: string;
  publisher?: string;
  publicationYear?: number;
  pageCount?: number;
  currentPage?: number;
  ddcCallNumber?: string;
  description?: string;
  shelfGroup: string;
  tags: string[];
  rating: number; // 0-5
  readingStatus: ReadingProgressStatus;
  completionDate?: string;
  loanedTo?: string;
  loanDate?: string;
  reminderDate?: string;
  reviewText?: string;
  privateNotes?: string;
  addedAt: string;
}

export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface Loan {
  id: string;
  bookId: string;
  copyBarcode?: string;
  bookTitle: string;
  bookIsbn: string;
  userId: string;
  userName: string;
  userGrade?: string;
  issueDate: string; // ISO YYYY-MM-DD
  dueDate: string;   // ISO YYYY-MM-DD
  returnDate?: string;
  issuedAtTimestamp?: string; // Exact ISO timestamp for anti-gaming minimum read duration verification
  returnedAtTimestamp?: string; // Exact ISO timestamp when checked in
  status: LoanStatus;
  renewalCount: number;
  lateFee: number; // Fine amount (MVR)
  amountPaid?: number;
  feePaid: boolean;
  waivedAmount?: number;
  waivedReason?: string;
  processedBy?: string;
}

export type LedgerTransactionType =
  | 'fine_accrual'
  | 'payment'
  | 'partial_payment'
  | 'waiver'
  | 'lost_replacement';

export interface LedgerTransaction {
  id: string;
  loanId?: string;
  userId: string;
  userName: string;
  bookTitle: string;
  type: LedgerTransactionType;
  amountMvr: number;
  date: string;
  notes?: string;
  processedBy: string;
}

export type ReservationStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface Reservation {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userName: string;
  requestDate: string;
  status: ReservationStatus;
  notes?: string;
}

export interface PatronTierPolicy {
  maxBooks: number;
  loanDays: number;
  maxRenewals: number;
  dailyFineMvr: number;
  graceDays: number;
  allowReferenceCheckout?: boolean;
}

export interface LibrarySettings {
  libraryName: string;
  maxBorrowDays: number;
  lateFeePerDay: number;
  maxRenewals: number;
  maxBooksPerStudent: number;
  gracePeriodDays: number;
  maxBooksPerStaff: number;
  staffBorrowDays: number;
  maxActiveReservations: number;
  holdExpiryDays: number;
  lostBookReplacementFee: number;
  allowReferenceCheckoutForStaff: boolean;
  maxOverdueFineCap: number;
  blockBorrowingFineThreshold: number;
  allowRecallRequests: boolean;
  holidayGraceDays: boolean;
  summerVacationCheckout: boolean;
  autoEmailRemindersDaysBefore: number;
  damagedBookMinorFee: number;
  policyNote: string;
  alertEmail?: string;
  alertSmsNumber?: string;
  enableAutoDueDateAlerts?: boolean;
  notifyParentOnOverdue?: boolean;
  schoolHolidays?: string[]; // ISO YYYY-MM-DD dates excluded from circulation & fines
  patronTierRules?: Record<'student' | 'teacher' | 'staff' | 'external', PatronTierPolicy>;
  annualAcquisitionsBudgetsMvr?: Record<string, number>;
  notificationTemplates?: Record<NotificationTemplateType, NotificationTemplatePair>;
  reminderScheduler?: ReminderScheduleConfig;
}

export type ReminderCadence =
  | 'daily_school_morning'
  | 'twice_weekly_sun_wed'
  | 'before_due_2d';

export interface ReminderScheduleConfig {
  enabled: boolean;
  cadence: ReminderCadence;
  runTimeLocal: string; // HH:mm e.g. "08:30"
  riskThresholdPct: number; // e.g. 40, 50, 65, 75
  defaultChannel: 'whatsapp' | 'sms' | 'email';
  includeBilingual: boolean;
  notifyParentsForStudents: boolean;
  skipMaldivianHolidays: boolean;
  lastAutoRunAt?: string;
}

export type NotificationTemplateType = 'overdue_notice' | 'hold_ready';

export interface NotificationTemplatePair {
  en: string;
  dv: string;
}

export type AuditActionType =
  | 'FINE_WAIVED'
  | 'FINE_SETTLED'
  | 'BALANCE_EDITED'
  | 'COPY_DELETED'
  | 'BOOK_DELETED'
  | 'BOOK_CREATED'
  | 'LOAN_ISSUED'
  | 'LOAN_RETURNED'
  | 'LOAN_RENEWED'
  | 'POLICY_UPDATED'
  | 'ROLE_CHANGED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_RESTORED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_DISPATCHED'
  | 'REMINDER_SCHEDULE_UPDATED'
  | 'REMINDER_BATCH_QUEUED'
  | 'SYSTEM_INIT';

export type AuditTargetType =
  | 'fine'
  | 'book'
  | 'copy'
  | 'loan'
  | 'user'
  | 'policy'
  | 'backup'
  | 'notification'
  | 'system';

export interface AuditLogEntry {
  id: string;
  action: AuditActionType;
  targetType: AuditTargetType;
  targetId: string;
  details: string;
  performedBy: string;
  performedById?: string;
  userRole: string;
  accessRole?: AccessRole;
  timestamp: string;
  integrityHash: string;
  immutable: true;
}

export interface LibrarySnapshotData {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  ledgerTransactions: LedgerTransaction[];
  acquisitions: AcquisitionRequest[];
  personalItems: PersonalItem[];
  auditLogs: AuditLogEntry[];
  settings: LibrarySettings;
}

export interface LibrarySnapshotArchive {
  schemaVersion: string;
  appId: string;
  exportedAt: string;
  exportedBy: string;
  encrypted: boolean;
  checksum: string;
  counts: {
    titles: number;
    copies: number;
    patrons: number;
    loans: number;
    reservations: number;
    ledgerTransactions: number;
    acquisitions: number;
    auditLogs: number;
  };
  data: LibrarySnapshotData;
}

export type AcquisitionStage =
  | 'Requested'
  | 'Approved'
  | 'Ordered'
  | 'Received & Cataloged'
  | 'Declined';

export type AcquisitionBudgetCategory =
  | 'Dhivehi Literature'
  | 'STEM & Technology'
  | 'Reference & Atlases'
  | 'Islamic Studies'
  | 'Fiction & Graded Readers';

export interface AcquisitionRequest {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  bookLanguage: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  budgetCategory: AcquisitionBudgetCategory;
  curriculumJustification: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByRole: UserRole;
  requestedDate: string;
  upvoterIds: string[];
  stage: AcquisitionStage;
  quantity: number;
  unitPriceMvr: number;
  vendorName?: string;
  vendorQuoteRef?: string;
  invoiceNumber?: string;
  isDonation?: boolean;
  donorName?: string;
  catalogedBookId?: string;
  receivedDate?: string;
  patronNotifiedAt?: string;
}

export interface NotificationLog {
  id: string;
  type: 'email' | 'sms';
  recipient: string;
  bookTitle: string;
  userName: string;
  sentAt: string;
  status: 'sent' | 'failed';
  messageId: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  iconName?: string;
}

export type {
  BibliographicLanguage,
  NormalizedMediaType,
  NormalizedCopyCondition,
  NormalizedCopyStatus,
  NormalizedPatronRole,
  NormalizedPatronStatus,
  NormalizedLoanStatus,
  NormalizedHoldStatus,
  FinancialLedgerEntryType,
  BibliographicTitle,
  PhysicalCopy,
  Patron,
  CirculationPolicy,
  LoanTransaction,
  HoldReservation,
  FinancialLedgerEntry,
  OfflineOutboxActionType,
  OfflineOutboxEntry,
  SyncConflictRecord,
  NormalizedLibrarySnapshot,
} from './schema/librarySchema';

