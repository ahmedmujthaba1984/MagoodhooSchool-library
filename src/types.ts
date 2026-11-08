export type UserRole = 'admin' | 'student' | 'parent' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  dhivehiName?: string;
  gender?: string;
  role: UserRole;
  parentId?: string; // For student: parent user id
  childrenIds?: string[]; // For parent: list of student ids
  grade?: string; // e.g. "Grade 8", "Grade 5"
  studentIdCode?: string; // e.g. "STU-1029"
  staffIdCode?: string; // e.g. "STF-3012"
  staffDepartment?: string; // e.g. "Science Dept", "Administration", "Primary Faculty"
  phone?: string;
  memberBarcodeUrl?: string;
  createdAt?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  barcode: string;
  barcodeImageUrl?: string; // Custom uploaded barcode image Data URL or link
  category: string;
  ddcCallNumber?: string; // Dewey Decimal Classification e.g. "DDC 823.91", "DDC 500"
  targetGrade?: string; // e.g. "Primary (Grades 1-5)", "Middle (Grades 6-8)", "Secondary (Grades 9-12)", "All Ages"
  bookLanguage?: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  isReferenceOnly: boolean;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string; // e.g., "Aisle 3, Shelf B"
  coverUrl: string;
  description: string;
  publisher: string;
  publicationYear: number;
  addedAt: string;
}

export type LoanStatus = 'active' | 'returned' | 'overdue';

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;
  bookIsbn: string;
  userId: string; // Student ID
  userName: string;
  userGrade?: string;
  issueDate: string; // ISO date string YYYY-MM-DD
  dueDate: string;   // ISO date string YYYY-MM-DD
  returnDate?: string; // ISO date string YYYY-MM-DD
  status: LoanStatus;
  renewalCount: number;
  lateFee: number; // in $ or points
  feePaid: boolean;
  processedBy?: string; // Librarian name
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
