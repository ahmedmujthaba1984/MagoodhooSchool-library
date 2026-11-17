import {
  OfflineOutboxActionType,
  OfflineOutboxEntry,
  SyncConflictRecord,
} from '../types';
import { offlineDb } from './offlineDb';

export interface OutboxSyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingEntries: OfflineOutboxEntry[];
  conflicts: SyncConflictRecord[];
}

type SyncListener = (state: OutboxSyncState) => void;

const OUTBOX_FALLBACK_STORAGE = 'magoodhoo_outbox_fallback_v2';
const CONFLICTS_FALLBACK_STORAGE = 'magoodhoo_sync_conflicts_v2';

function createIdempotencyKey(action: OfflineOutboxActionType): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${action}-${crypto.randomUUID()}`;
  }
  return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocalStorageFallback<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStorageFallback<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

class OfflineOutboxSyncEngine {
  private listeners = new Set<SyncListener>();
  private state: OutboxSyncState = {
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    pendingEntries: [],
    conflicts: [],
  };
  private initialized = false;

  async init(): Promise<OutboxSyncState> {
    if (!this.initialized) {
      this.initialized = true;
      await this.refreshState();
    }
    return this.state;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    if (!this.initialized) {
      void this.init();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): OutboxSyncState {
    return this.state;
  }

  private emit() {
    for (const cb of this.listeners) {
      cb(this.state);
    }
  }

  async refreshState(): Promise<OutboxSyncState> {
    const idbOutbox = await offlineDb.getOutboxEntries();
    const idbConflicts = await offlineDb.getSyncConflicts();

    const entries =
      idbOutbox.length > 0
        ? idbOutbox
        : readLocalStorageFallback<OfflineOutboxEntry>(OUTBOX_FALLBACK_STORAGE);

    const conflicts =
      idbConflicts.length > 0
        ? idbConflicts
        : readLocalStorageFallback<SyncConflictRecord>(CONFLICTS_FALLBACK_STORAGE);

    const pendingEntries = entries
      .filter((e) => e.status === 'pending' || e.status === 'failed' || e.status === 'syncing')
      .sort((a, b) => a.client_timestamp.localeCompare(b.client_timestamp));

    this.state = {
      ...this.state,
      pendingCount: pendingEntries.length,
      pendingEntries,
      conflicts: conflicts.sort((a, b) => b.detected_at.localeCompare(a.detected_at)),
    };
    this.emit();
    return this.state;
  }

  /**
   * Queue an offline circulation/catalog operation and update optimistic IndexedDB state.
   */
  async enqueueOperation(params: {
    action: OfflineOutboxActionType;
    endpoint: string;
    payload: Record<string, any>;
    base_version?: number;
  }): Promise<OfflineOutboxEntry> {
    const entry: OfflineOutboxEntry = {
      outbox_id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      idempotency_key: createIdempotencyKey(params.action),
      action: params.action,
      endpoint: params.endpoint,
      payload: params.payload,
      client_timestamp: new Date().toISOString(),
      base_version: params.base_version ?? 1,
      status: 'pending',
      attempts: 0,
    };

    // Persist in IndexedDB + fallback localStorage
    await offlineDb.putOutboxEntry(entry);
    const fallback = readLocalStorageFallback<OfflineOutboxEntry>(OUTBOX_FALLBACK_STORAGE);
    writeLocalStorageFallback(OUTBOX_FALLBACK_STORAGE, [...fallback, entry]);

    // Optimistically update normalized IndexedDB stores for offline continuity
    await this.applyOptimisticNormalizedUpdate(entry);
    await this.refreshState();
    return entry;
  }

  private async applyOptimisticNormalizedUpdate(entry: OfflineOutboxEntry): Promise<void> {
    try {
      if (entry.action === 'checkout') {
        const copies = await offlineDb.getPhysicalCopies();
        const barcode = entry.payload.copyBarcode || entry.payload.bookId;
        const copy = copies.find(
          (c) => c.barcode === barcode || c.title_id === entry.payload.bookId
        );
        if (copy) {
          await offlineDb.putPhysicalCopy({
            ...copy,
            status: 'checked_out',
            current_loan_id: entry.payload.localLoanId || entry.outbox_id,
          });
        }
        if (entry.payload.localLoanId) {
          await offlineDb.putLoanTransaction({
            loan_id: entry.payload.localLoanId,
            copy_id: copy?.copy_id || `${entry.payload.bookId}-copy-1`,
            title_id: entry.payload.bookId,
            copy_barcode: copy?.barcode || entry.payload.copyBarcode || '',
            patron_id: entry.payload.userId,
            issue_date: entry.client_timestamp.split('T')[0],
            due_date: entry.payload.dueDate || entry.client_timestamp.split('T')[0],
            return_date: null,
            renewal_count: 0,
            status: 'active',
            accrued_fine_mvr: 0,
            paid_fine_mvr: 0,
            waived_fine_mvr: 0,
            processed_by: entry.payload.librarianId || 'Offline Desk',
            offline_synced: false,
            version: 1,
          });
        }
      } else if (entry.action === 'checkin') {
        const copies = await offlineDb.getPhysicalCopies();
        const copy = copies.find(
          (c) =>
            (entry.payload.copyBarcode && c.barcode === entry.payload.copyBarcode) ||
            (entry.payload.loanId && c.current_loan_id === entry.payload.loanId)
        );
        if (copy) {
          await offlineDb.putPhysicalCopy({
            ...copy,
            status: 'available',
            current_loan_id: null,
          });
        }
        if (entry.payload.loanId) {
          const loans = await offlineDb.getLoanTransactions();
          const loan = loans.find((l) => l.loan_id === entry.payload.loanId);
          if (loan) {
            await offlineDb.putLoanTransaction({
              ...loan,
              return_date: entry.client_timestamp.split('T')[0],
              status: 'returned',
              accrued_fine_mvr: entry.payload.calculatedFee ?? loan.accrued_fine_mvr,
              offline_synced: false,
              version: loan.version + 1,
            });
          }
        }
      } else if (entry.action === 'reserve') {
        await offlineDb.putHoldReservation({
          reservation_id: entry.payload.id || entry.outbox_id,
          title_id: entry.payload.bookId,
          copy_id: null,
          patron_id: entry.payload.userId,
          requested_at: entry.payload.requestDate || entry.client_timestamp.split('T')[0],
          expires_at: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          queue_position: 1,
          status: 'pending',
          notes: 'Queued offline — awaiting sync',
        });
      }
    } catch {}
  }

  private classifyConflict(
    action: OfflineOutboxActionType,
    statusCode: number,
    serverMessage: string
  ): SyncConflictRecord['conflict_type'] {
    const msg = serverMessage.toLowerCase();
    if (msg.includes('hold') || msg.includes('reserved') || msg.includes('reservation')) {
      return 'hold_conflict';
    }
    if (msg.includes('already') && msg.includes('returned')) {
      return 'loan_already_returned';
    }
    if (
      action === 'checkout' ||
      msg.includes('checked out') ||
      msg.includes('not available') ||
      msg.includes('no physical copies')
    ) {
      return 'copy_already_checked_out';
    }
    if (statusCode === 404) {
      return 'not_found';
    }
    return 'policy_violation';
  }

  private async reconcileOptimisticStateOnConflict(entry: OfflineOutboxEntry): Promise<void> {
    try {
      if (entry.action === 'checkout' && entry.payload.localLoanId) {
        const loans = await offlineDb.getLoanTransactions();
        const target = loans.find((l) => l.loan_id === entry.payload.localLoanId);
        if (target) {
          await offlineDb.putLoanTransaction({
            ...target,
            status: 'returned',
            return_date: new Date().toISOString().split('T')[0],
            offline_synced: true,
          });
        }
      }
    } catch {}
  }

  /**
   * Flush all pending offline outbox operations in chronological FIFO order
   * with deterministic conflict resolution against the backend server.
   */
  async flushOutbox(options?: {
    onEntrySynced?: (entry: OfflineOutboxEntry, responseJson: any) => void;
    onConflictDetected?: (conflict: SyncConflictRecord) => void;
  }): Promise<{
    syncedCount: number;
    conflictCount: number;
    remainingCount: number;
  }> {
    if (this.state.isSyncing) {
      return {
        syncedCount: 0,
        conflictCount: 0,
        remainingCount: this.state.pendingCount,
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        syncedCount: 0,
        conflictCount: 0,
        remainingCount: this.state.pendingCount,
      };
    }

    await this.refreshState();
    const pending = [...this.state.pendingEntries];
    if (pending.length === 0) {
      return { syncedCount: 0, conflictCount: 0, remainingCount: 0 };
    }

    this.state = { ...this.state, isSyncing: true };
    this.emit();

    let syncedCount = 0;
    let conflictCount = 0;

    for (const entry of pending) {
      try {
        const res = await fetch(entry.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': entry.idempotency_key,
            'x-user-role': entry.payload.userRole || 'admin',
            'x-user-id': entry.payload.librarianId || 'offline-sync-engine',
          },
          body: JSON.stringify({
            ...entry.payload,
            idempotencyKey: entry.idempotency_key,
            clientTimestamp: entry.client_timestamp,
            baseVersion: entry.base_version,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          await offlineDb.deleteOutboxEntry(entry.outbox_id);
          const remainingFb = readLocalStorageFallback<OfflineOutboxEntry>(OUTBOX_FALLBACK_STORAGE).filter(
            (e) => e.outbox_id !== entry.outbox_id
          );
          writeLocalStorageFallback(OUTBOX_FALLBACK_STORAGE, remainingFb);
          syncedCount++;
          options?.onEntrySynced?.(entry, data);
        } else if (res.status === 409 || res.status === 400 || res.status === 403 || res.status === 404) {
          // Deterministic Conflict Resolution: Server authority wins and local optimistic state reconciles
          const serverReason = data?.error || `HTTP ${res.status} business rule conflict`;
          const conflict: SyncConflictRecord = {
            conflict_id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            outbox_id: entry.outbox_id,
            action: entry.action,
            conflict_type: this.classifyConflict(entry.action, res.status, serverReason),
            resolution_strategy: 'server_wins_reconciled',
            local_payload: entry.payload,
            server_reason: serverReason,
            detected_at: new Date().toISOString(),
            resolved: false,
          };

          await this.reconcileOptimisticStateOnConflict(entry);
          await offlineDb.putSyncConflict(conflict);
          const prevConflicts = readLocalStorageFallback<SyncConflictRecord>(CONFLICTS_FALLBACK_STORAGE);
          writeLocalStorageFallback(CONFLICTS_FALLBACK_STORAGE, [conflict, ...prevConflicts]);

          // Remove conflicting item from active retry queue so it doesn't block FIFO queue
          await offlineDb.deleteOutboxEntry(entry.outbox_id);
          const remainingFb = readLocalStorageFallback<OfflineOutboxEntry>(OUTBOX_FALLBACK_STORAGE).filter(
            (e) => e.outbox_id !== entry.outbox_id
          );
          writeLocalStorageFallback(OUTBOX_FALLBACK_STORAGE, remainingFb);

          conflictCount++;
          options?.onConflictDetected?.(conflict);
        } else {
          // Transient 5xx error — retain for retry
          const updated: OfflineOutboxEntry = {
            ...entry,
            status: 'failed',
            attempts: entry.attempts + 1,
            last_error: data?.error || `HTTP ${res.status}`,
          };
          await offlineDb.putOutboxEntry(updated);
        }
      } catch (err: any) {
        const updated: OfflineOutboxEntry = {
          ...entry,
          status: 'pending',
          attempts: entry.attempts + 1,
          last_error: err?.message || 'Network unreachable',
        };
        await offlineDb.putOutboxEntry(updated);
      }
    }

    this.state = {
      ...this.state,
      isSyncing: false,
      lastSyncedAt: syncedCount > 0 ? new Date().toISOString() : this.state.lastSyncedAt,
    };
    await this.refreshState();

    return {
      syncedCount,
      conflictCount,
      remainingCount: this.state.pendingCount,
    };
  }

  async dismissConflict(conflictId: string): Promise<void> {
    await offlineDb.deleteSyncConflict(conflictId);
    const nextFb = readLocalStorageFallback<SyncConflictRecord>(CONFLICTS_FALLBACK_STORAGE).filter(
      (c) => c.conflict_id !== conflictId
    );
    writeLocalStorageFallback(CONFLICTS_FALLBACK_STORAGE, nextFb);
    await this.refreshState();
  }

  async clearAllConflicts(): Promise<void> {
    await offlineDb.clearSyncConflicts();
    writeLocalStorageFallback(CONFLICTS_FALLBACK_STORAGE, []);
    await this.refreshState();
  }
}

export const offlineSyncEngine = new OfflineOutboxSyncEngine();
