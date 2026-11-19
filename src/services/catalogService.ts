import { Book, BookCopy, BibliographicTitle, PhysicalCopy } from '../types';
import {
  subscribeBooks,
  addBook as firestoreAddBook,
  updateBook as firestoreUpdateBook,
  deleteBook as firestoreDeleteBook,
} from '../lib/firebase';
import { offlineDb } from '../lib/offlineDb';
import {
  fetchExternalMetadata,
  type ExternalMetadataResult,
} from './metadataFetcher';
import {
  toBibliographicTitle,
  toPhysicalCopies,
} from '../schema/librarySchema';
import {
  analyzeCatalogHealth,
  inferDdcAndShelf,
  normalizeAuthorName,
  type CatalogHealthReport,
} from '../lib/catalogHealth';
import {
  exportCatalogToCsv,
  exportCatalogToJson,
  exportToMarc21,
} from '../lib/dataPortability';

export type { ExternalMetadataResult, CatalogHealthReport };

export interface CatalogTitleWithCopies {
  title: BibliographicTitle;
  copies: PhysicalCopy[];
  availableCount: number;
  totalCount: number;
}

export const catalogService = {
  // Real-time Firestore Catalog Listeners & CRUD
  subscribeCatalog: subscribeBooks,

  async createBook(bookData: Omit<Book, 'id'>): Promise<string> {
    return firestoreAddBook(bookData);
  },

  async updateBook(bookId: string, patch: Partial<Book>): Promise<void> {
    return firestoreUpdateBook(bookId, patch);
  },

  async removeBook(bookId: string): Promise<void> {
    return firestoreDeleteBook(bookId);
  },

  // Offline IndexedDB Cache
  async loadCachedCatalog(): Promise<Book[]> {
    return offlineDb.getCatalogBooks();
  },

  async saveCachedCatalog(books: Book[]): Promise<void> {
    await offlineDb.saveCatalogBooks(books);
  },

  // External ISBN / UPC Metadata Auto-Fill (Open Library + Google Books + Proxy)
  async lookupByIsbnOrUpc(code: string): Promise<ExternalMetadataResult | null> {
    return fetchExternalMetadata(code);
  },

  // Koha-Style Parent-Child Normalized Model Helpers
  toNormalizedRecord(book: Book): CatalogTitleWithCopies {
    const title = toBibliographicTitle(book);
    const copies = toPhysicalCopies(book);
    const availableCount = copies.filter((c) => c.status === 'available').length;
    return {
      title,
      copies,
      availableCount,
      totalCount: copies.length,
    };
  },

  findBookByBarcodeOrIsbn(books: Book[], rawCode: string): Book | undefined {
    const clean = (rawCode || '').trim().toLowerCase();
    const compact = clean.replace(/[-\s]/g, '');
    if (!clean) return undefined;

    return books.find((book) => {
      if ((book.barcode || '').toLowerCase() === clean) return true;
      if ((book.isbn || '').replace(/[-\s]/g, '').toLowerCase() === compact) return true;
      if (
        Array.isArray(book.copies) &&
        book.copies.some(
          (copy: BookCopy) =>
            (copy.barcode || '').toLowerCase() === clean ||
            (copy.accessionNumber || '').toLowerCase() === clean
        )
      ) {
        return true;
      }
      return false;
    });
  },

  findAvailableCopy(book: Book): BookCopy | undefined {
    if (!Array.isArray(book.copies) || book.copies.length === 0) return undefined;
    return book.copies.find((c) => c.status === 'Available');
  },

  // Catalog Health & Authority Helpers
  auditCatalogHealth(books: Book[]): CatalogHealthReport {
    return analyzeCatalogHealth(books);
  },

  inferClassification(book: Book) {
    return inferDdcAndShelf(book);
  },

  standardizeAuthor(rawAuthor: string): string {
    return normalizeAuthorName(rawAuthor);
  },

  // Zero-Lock-In Data Portability
  exportCsv(books: Book[], prefix = 'magoodhoo_catalog') {
    exportCatalogToCsv(books, prefix);
  },

  exportJson(books: Book[], prefix = 'magoodhoo_catalog') {
    exportCatalogToJson(books, prefix);
  },

  exportMarc21(books: Book[], prefix = 'magoodhoo_marc21') {
    exportToMarc21(books, prefix);
  },
};
