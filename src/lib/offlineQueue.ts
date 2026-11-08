import { Reservation } from '../types';

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
    return item;
  },

  remove(id: string) {
    const queue = this.getQueue().filter((q) => q.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn('Failed to update offline reservation queue:', err);
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  async syncQueue(
    syncHandler: (item: QueuedReservation) => Promise<boolean>
  ): Promise<{ syncedCount: number; remainingCount: number }> {
    const queue = this.getQueue();
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

    return { syncedCount, remainingCount: remaining.length };
  },
};
