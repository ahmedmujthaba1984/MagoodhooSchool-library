import { db, isQuotaExhaustedError, triggerQuotaExhausted } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

const CATEGORIES_COL = 'categories';
const LOCAL_STORAGE_KEY = 'library_categories_v1';
const CATEGORIES_SEEDED_KEY = 'library_categories_seeded_flag_v2';

export const DEFAULT_CATEGORIES = [
  'Fiction / Literature',
  'Science & Nature',
  'History & Social Studies',
  'Children Literature',
  'Reference & Dictionaries',
  'Arts & Music',
  'Computer Science & STEM'
];

export function getStoredCategories(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading categories from localStorage:', e);
  }
  return DEFAULT_CATEGORIES;
}

export function subscribeCategories(callback: (categories: string[]) => void) {
  try {
    const unsubscribe = onSnapshot(collection(db, CATEGORIES_COL), (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => doc.data().name as string).filter(Boolean);
        // Save to localStorage as backup
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        callback(list);
      } else {
        // Seed default categories into Firestore at most once
        if (typeof window !== 'undefined' && !localStorage.getItem(CATEGORIES_SEEDED_KEY)) {
          localStorage.setItem(CATEGORIES_SEEDED_KEY, 'true');
          DEFAULT_CATEGORIES.forEach(async (catName) => {
            try {
              const docId = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              await setDoc(doc(db, CATEGORIES_COL, docId), { name: catName, createdAt: new Date().toISOString() });
            } catch (err) {
              if (isQuotaExhaustedError(err)) {
                triggerQuotaExhausted('Google Cloud Firestore free tier daily write limit reached. Categories are saved locally.');
              }
              console.warn('Could not seed category:', err);
            }
          });
        }
        callback(getStoredCategories());
      }
    }, (err) => {
      if (isQuotaExhaustedError(err)) {
        triggerQuotaExhausted('Google Cloud Firestore write limit reached. Reading categories from offline cache.');
      }
      console.warn('Firestore categories subscription notice, using cache:', err);
      callback(getStoredCategories());
    });
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore subscription fallback:', err);
    callback(getStoredCategories());
    return () => {};
  }
}

export async function addCategoryToStore(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const docId = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Save to Firestore with error resilience
  try {
    await setDoc(doc(db, CATEGORIES_COL, docId), { name: trimmed, createdAt: new Date().toISOString() });
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      triggerQuotaExhausted('Category saved to local cache; Cloud Firestore daily write quota limit reached.');
    }
    console.warn('Notice saving category to firestore (persisted locally):', e);
  }

  // Save to localStorage
  const current = getStoredCategories();
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }
}

export async function updateCategoryInStore(oldName: string, newName: string) {
  const trimmedNew = newName.trim();
  if (!trimmedNew || oldName === trimmedNew) return;

  const oldDocId = oldName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const newDocId = trimmedNew.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  try {
    await deleteDoc(doc(db, CATEGORIES_COL, oldDocId));
    await setDoc(doc(db, CATEGORIES_COL, newDocId), { name: trimmedNew, createdAt: new Date().toISOString() });
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      triggerQuotaExhausted('Category updated in local cache; Cloud Firestore daily write quota limit reached.');
    }
    console.warn('Notice updating category in firestore (persisted locally):', e);
  }

  const current = getStoredCategories();
  const updated = current.map(c => c === oldName ? trimmedNew : c);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
}

export async function deleteCategoryFromStore(name: string) {
  const docId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  try {
    await deleteDoc(doc(db, CATEGORIES_COL, docId));
  } catch (e) {
    if (isQuotaExhaustedError(e)) {
      triggerQuotaExhausted('Category deleted from local cache; Cloud Firestore daily write quota limit reached.');
    }
    console.warn('Notice deleting category from firestore (persisted locally):', e);
  }

  const current = getStoredCategories();
  const updated = current.filter(c => c !== name);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
}
