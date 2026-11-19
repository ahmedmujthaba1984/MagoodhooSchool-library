import { MediaType, PersonalItem, ReadingProgressStatus } from '../types';
import { offlineDb } from '../lib/offlineDb';
import {
  exportCatalogToCsv,
  exportCatalogToJson,
  exportToMarc21,
  mapCsvRowsToPersonalItems,
  parseCsvPreview,
  parseImportedPersonalData,
  suggestCsvMapping,
} from '../lib/dataPortability';

export const PERSONAL_LIBRARY_STORAGE_KEY = 'magoodhoo_personal_library';

export interface PersonalLibraryFilterOptions {
  ownerId?: string;
  query?: string;
  mediaType?: MediaType | 'all';
  readingStatus?: ReadingProgressStatus | 'all';
  shelfGroup?: string | 'all';
  tag?: string | 'all';
}

export interface PersonalLibraryStats {
  totalItems: number;
  completedCount: number;
  inProgressCount: number;
  toReadCount: number;
  loanedOutCount: number;
  totalPagesRead: number;
  completionRatePct: number;
  overdueFriendLoans: PersonalItem[];
}

export const personalLibraryService = {
  loadLocalItems(fallback: PersonalItem[] = []): PersonalItem[] {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(PERSONAL_LIBRARY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as PersonalItem[];
        }
      }
    } catch {
      // Ignore malformed cache
    }
    return fallback;
  },

  async hydrateFromIndexedDb(fallback: PersonalItem[] = []): Promise<PersonalItem[]> {
    const cached = await offlineDb.getPersonalItems();
    if (cached && cached.length > 0) return cached;
    return this.loadLocalItems(fallback);
  },

  async persistItems(items: PersonalItem[]): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage quota errors
      }
    }
    await offlineDb.savePersonalItems(items);
  },

  filterItems(items: PersonalItem[], opts: PersonalLibraryFilterOptions): PersonalItem[] {
    const q = (opts.query || '').trim().toLowerCase();

    return items.filter((item) => {
      if (opts.ownerId && item.ownerId !== opts.ownerId) return false;
      if (opts.mediaType && opts.mediaType !== 'all' && item.mediaType !== opts.mediaType) {
        return false;
      }
      if (
        opts.readingStatus &&
        opts.readingStatus !== 'all' &&
        item.readingStatus !== opts.readingStatus
      ) {
        return false;
      }
      if (opts.shelfGroup && opts.shelfGroup !== 'all' && item.shelfGroup !== opts.shelfGroup) {
        return false;
      }
      if (opts.tag && opts.tag !== 'all' && !(item.tags || []).includes(opts.tag)) {
        return false;
      }
      if (q) {
        const hay = [
          item.title,
          item.author,
          item.isbn,
          item.upc,
          item.shelfGroup,
          item.publisher,
          item.loanedTo,
          ...(item.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },

  computeStats(items: PersonalItem[]): PersonalLibraryStats {
    const today = new Date().toISOString().split('T')[0];
    const totalItems = items.length;
    const completedCount = items.filter((i) => i.readingStatus === 'Completed').length;
    const inProgressCount = items.filter((i) => i.readingStatus === 'In Progress').length;
    const toReadCount = items.filter((i) => i.readingStatus === 'To Read').length;
    const loanedOutCount = items.filter((i) => i.readingStatus === 'Loaned to Friend').length;

    const totalPagesRead = items.reduce((sum, item) => {
      if (item.readingStatus === 'Completed') {
        return sum + (item.pageCount || item.currentPage || 0);
      }
      return sum + (item.currentPage || 0);
    }, 0);

    const overdueFriendLoans = items.filter(
      (i) =>
        i.readingStatus === 'Loaned to Friend' &&
        Boolean(i.reminderDate) &&
        String(i.reminderDate) < today
    );

    return {
      totalItems,
      completedCount,
      inProgressCount,
      toReadCount,
      loanedOutCount,
      totalPagesRead,
      completionRatePct: totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
      overdueFriendLoans,
    };
  },

  // Import / Export Portability
  parseCsvPreview,
  suggestCsvMapping,
  mapCsvRowsToPersonalItems,
  parseImportedPersonalData,
  exportCsv(items: PersonalItem[], prefix = 'magoodhoo_personal_shelf') {
    exportCatalogToCsv(items, prefix);
  },
  exportJson(items: PersonalItem[], prefix = 'magoodhoo_personal_shelf') {
    exportCatalogToJson(items, prefix);
  },
  exportMarc21(items: PersonalItem[], prefix = 'magoodhoo_personal_marc21') {
    exportToMarc21(items, prefix);
  },
};
