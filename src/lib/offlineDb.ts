import {
  Book,
  PersonalItem,
  BibliographicTitle,
  PhysicalCopy,
  Patron,
  CirculationPolicy,
  LoanTransaction,
  HoldReservation,
  FinancialLedgerEntry,
  OfflineOutboxEntry,
  SyncConflictRecord,
  NormalizedLibrarySnapshot,
} from '../types';

const DB_NAME = 'magoodhoo_ils_offline_db';
const DB_VERSION = 2;

export const IDB_STORES = {
  CATALOG: 'catalog_books',
  PERSONAL: 'personal_items',
  QUEUE: 'sync_queue',
  TITLES: 'bibliographic_titles',
  COPIES: 'physical_copies',
  PATRONS: 'patrons',
  POLICIES: 'circulation_policies',
  LOANS: 'loan_transactions',
  HOLDS: 'hold_reservations',
  LEDGER: 'financial_ledger',
  OUTBOX: 'outbox_transactions',
  CONFLICTS: 'sync_conflicts',
} as const;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;

        // Legacy UI snapshot stores
        if (!db.objectStoreNames.contains(IDB_STORES.CATALOG)) {
          db.createObjectStore(IDB_STORES.CATALOG, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.PERSONAL)) {
          db.createObjectStore(IDB_STORES.PERSONAL, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.QUEUE)) {
          db.createObjectStore(IDB_STORES.QUEUE, { keyPath: 'id' });
        }

        // Normalized Koha-style relational stores
        if (!db.objectStoreNames.contains(IDB_STORES.TITLES)) {
          const store = db.createObjectStore(IDB_STORES.TITLES, { keyPath: 'id' });
          store.createIndex('isbn13', 'isbn13', { unique: false });
          store.createIndex('ddc_code', 'ddc_code', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.COPIES)) {
          const store = db.createObjectStore(IDB_STORES.COPIES, { keyPath: 'copy_id' });
          store.createIndex('title_id', 'title_id', { unique: false });
          store.createIndex('barcode', 'barcode', { unique: true });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.PATRONS)) {
          const store = db.createObjectStore(IDB_STORES.PATRONS, { keyPath: 'patron_id' });
          store.createIndex('barcode_id', 'barcode_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.POLICIES)) {
          db.createObjectStore(IDB_STORES.POLICIES, { keyPath: 'role' });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.LOANS)) {
          const store = db.createObjectStore(IDB_STORES.LOANS, { keyPath: 'loan_id' });
          store.createIndex('patron_id', 'patron_id', { unique: false });
          store.createIndex('title_id', 'title_id', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.HOLDS)) {
          const store = db.createObjectStore(IDB_STORES.HOLDS, { keyPath: 'reservation_id' });
          store.createIndex('title_id', 'title_id', { unique: false });
          store.createIndex('patron_id', 'patron_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.LEDGER)) {
          const store = db.createObjectStore(IDB_STORES.LEDGER, { keyPath: 'entry_id' });
          store.createIndex('patron_id', 'patron_id', { unique: false });
        }

        // Offline Outbox & Sync Conflict Resolution Stores
        if (!db.objectStoreNames.contains(IDB_STORES.OUTBOX)) {
          const store = db.createObjectStore(IDB_STORES.OUTBOX, { keyPath: 'outbox_id' });
          store.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.CONFLICTS)) {
          db.createObjectStore(IDB_STORES.CONFLICTS, { keyPath: 'conflict_id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function replaceAllRecords<T>(storeName: string, records: T[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

async function putOneRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

async function deleteOneRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  const rows = await new Promise<T[]>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
  db.close();
  return rows;
}

export const offlineDb = {
  // Legacy Snapshots
  async saveCatalogBooks(books: Book[]): Promise<void> {
    await replaceAllRecords(IDB_STORES.CATALOG, books);
  },
  async getCatalogBooks(): Promise<Book[]> {
    return getAllRecords<Book>(IDB_STORES.CATALOG);
  },
  async savePersonalItems(items: PersonalItem[]): Promise<void> {
    await replaceAllRecords(IDB_STORES.PERSONAL, items);
  },
  async getPersonalItems(): Promise<PersonalItem[]> {
    return getAllRecords<PersonalItem>(IDB_STORES.PERSONAL);
  },
  async saveSyncQueue(items: Array<{ id: string; [key: string]: any }>): Promise<void> {
    await replaceAllRecords(IDB_STORES.QUEUE, items);
  },
  async getSyncQueue<T = any>(): Promise<T[]> {
    return getAllRecords<T>(IDB_STORES.QUEUE);
  },

  // Normalized Relational Stores
  async syncNormalizedSnapshot(snapshot: NormalizedLibrarySnapshot): Promise<void> {
    await Promise.all([
      replaceAllRecords<BibliographicTitle>(IDB_STORES.TITLES, snapshot.titles),
      replaceAllRecords<PhysicalCopy>(IDB_STORES.COPIES, snapshot.copies),
      replaceAllRecords<Patron>(IDB_STORES.PATRONS, snapshot.patrons),
      replaceAllRecords<CirculationPolicy>(IDB_STORES.POLICIES, snapshot.policies),
      replaceAllRecords<LoanTransaction>(IDB_STORES.LOANS, snapshot.loans),
      replaceAllRecords<HoldReservation>(IDB_STORES.HOLDS, snapshot.holds),
      replaceAllRecords<FinancialLedgerEntry>(IDB_STORES.LEDGER, snapshot.ledger),
    ]);
  },

  async getTitles(): Promise<BibliographicTitle[]> {
    return getAllRecords<BibliographicTitle>(IDB_STORES.TITLES);
  },
  async getPhysicalCopies(): Promise<PhysicalCopy[]> {
    return getAllRecords<PhysicalCopy>(IDB_STORES.COPIES);
  },
  async putPhysicalCopy(copy: PhysicalCopy): Promise<void> {
    await putOneRecord(IDB_STORES.COPIES, copy);
  },
  async getPatrons(): Promise<Patron[]> {
    return getAllRecords<Patron>(IDB_STORES.PATRONS);
  },
  async getCirculationPolicies(): Promise<CirculationPolicy[]> {
    return getAllRecords<CirculationPolicy>(IDB_STORES.POLICIES);
  },
  async getLoanTransactions(): Promise<LoanTransaction[]> {
    return getAllRecords<LoanTransaction>(IDB_STORES.LOANS);
  },
  async putLoanTransaction(loan: LoanTransaction): Promise<void> {
    await putOneRecord(IDB_STORES.LOANS, loan);
  },
  async getHoldReservations(): Promise<HoldReservation[]> {
    return getAllRecords<HoldReservation>(IDB_STORES.HOLDS);
  },
  async putHoldReservation(hold: HoldReservation): Promise<void> {
    await putOneRecord(IDB_STORES.HOLDS, hold);
  },
  async getFinancialLedger(): Promise<FinancialLedgerEntry[]> {
    return getAllRecords<FinancialLedgerEntry>(IDB_STORES.LEDGER);
  },
  async putFinancialLedgerEntry(entry: FinancialLedgerEntry): Promise<void> {
    await putOneRecord(IDB_STORES.LEDGER, entry);
  },

  // Outbox & Conflict Resolution Stores
  async getOutboxEntries(): Promise<OfflineOutboxEntry[]> {
    return getAllRecords<OfflineOutboxEntry>(IDB_STORES.OUTBOX);
  },
  async putOutboxEntry(entry: OfflineOutboxEntry): Promise<void> {
    await putOneRecord(IDB_STORES.OUTBOX, entry);
  },
  async deleteOutboxEntry(outboxId: string): Promise<void> {
    await deleteOneRecord(IDB_STORES.OUTBOX, outboxId);
  },
  async clearOutbox(): Promise<void> {
    await replaceAllRecords(IDB_STORES.OUTBOX, []);
  },

  async getSyncConflicts(): Promise<SyncConflictRecord[]> {
    return getAllRecords<SyncConflictRecord>(IDB_STORES.CONFLICTS);
  },
  async putSyncConflict(conflict: SyncConflictRecord): Promise<void> {
    await putOneRecord(IDB_STORES.CONFLICTS, conflict);
  },
  async deleteSyncConflict(conflictId: string): Promise<void> {
    await deleteOneRecord(IDB_STORES.CONFLICTS, conflictId);
  },
  async clearSyncConflicts(): Promise<void> {
    await replaceAllRecords(IDB_STORES.CONFLICTS, []);
  },
};
