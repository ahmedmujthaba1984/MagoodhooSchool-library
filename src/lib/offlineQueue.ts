import { offlineDb } from './offlineDb';

export interface QueuedReservation {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userName: string;
  userGrade?: string;
  requestDate: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
}

const STORAGE_KEY = 'library_offline_reservations_queue';

export const offlineQueue = {
  getQueue(): QueuedReservation[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async hydrateFromIndexedDb(): Promise<QueuedReservation[]> {
    const local = this.getQueue();
    if (local.length > 0) return local;
    const idbQueue = await offlineDb.getSyncQueue<QueuedReservation>();
    if (idbQueue.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(idbQueue));
      } catch {}
    }
    return idbQueue;
  },

  enqueue(reservation: Omit<QueuedReservation, 'attempts' | 'status'>): QueuedReservation {
    const queue = this.getQueue();
    const item: QueuedReservation = {
      ...reservation,
      status: 'pending',
      attempts: 0,
    };
    queue.push(item);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn('Failed to save to offline reservation queue:', err);
    }
    void offlineDb.saveSyncQueue(queue);
    return item;
  },

  remove(id: string) {
    const queue = this.getQueue().filter((q) => q.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn('Failed to update offline reservation queue:', err);
    }
    void offlineDb.saveSyncQueue(queue);
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    void offlineDb.saveSyncQueue([]);
  },

  async syncQueue(
    syncHandler: (item: QueuedReservation) => Promise<boolean>
  ): Promise<{ syncedCount: number; remainingCount: number }> {
    const queue = await this.hydrateFromIndexedDb();
    if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

    let syncedCount = 0;
    const remaining: QueuedReservation[] = [];

    for (const item of queue) {
      try {
        const success = await syncHandler(item);
        if (success) {
          syncedCount++;
        } else {
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      } catch (err) {
        console.warn(`Failed to sync reservation ${item.id}:`, err);
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    } catch {}
    void offlineDb.saveSyncQueue(remaining);

    return { syncedCount, remainingCount: remaining.length };
  },
};
