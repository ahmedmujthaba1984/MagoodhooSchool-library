import {
  buildNormalizedSnapshot,
  BibliographicTitle,
  PhysicalCopy,
  Patron,
  CirculationPolicy,
  LoanTransaction,
  HoldReservation,
  FinancialLedgerEntry,
  NormalizedLibrarySnapshot,
} from '../schema/librarySchema';
import {
  sampleBooks,
  sampleUsers,
  sampleLoans,
  sampleReservations,
  samplePersonalItems,
  sampleLedgerTransactions,
  initialSettings,
} from './seedData';

/**
 * Complete normalized Koha-style relational seed dataset for
 * F. Magoodhoo School Library Portal (with bilingual English & Thaana Dhivehi records).
 */
export const normalizedSeedSnapshot: NormalizedLibrarySnapshot = buildNormalizedSnapshot({
  books: sampleBooks,
  personalItems: samplePersonalItems,
  users: sampleUsers,
  loans: sampleLoans,
  reservations: sampleReservations,
  ledgerTransactions: sampleLedgerTransactions,
  settings: initialSettings,
});

export const seedBibliographicTitles: BibliographicTitle[] = normalizedSeedSnapshot.titles;
export const seedPhysicalCopies: PhysicalCopy[] = normalizedSeedSnapshot.copies;
export const seedPatrons: Patron[] = normalizedSeedSnapshot.patrons;
export const seedCirculationPolicies: CirculationPolicy[] = normalizedSeedSnapshot.policies;
export const seedLoanTransactions: LoanTransaction[] = normalizedSeedSnapshot.loans;
export const seedHoldReservations: HoldReservation[] = normalizedSeedSnapshot.holds;
export const seedFinancialLedger: FinancialLedgerEntry[] = normalizedSeedSnapshot.ledger;
