export type UserRole = 'admin' | 'student' | 'parent' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
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
}

export interface CategoryOption {
  id: string;
  name: string;
  iconName?: string;
}
