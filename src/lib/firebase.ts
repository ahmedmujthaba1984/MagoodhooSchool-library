import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Book, UserProfile, Loan, Reservation, LibrarySettings } from '../types';
import { sampleBooks, sampleUsers, sampleLoans, sampleReservations, initialSettings } from '../data/seedData';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with force long polling to prevent WebChannel stream disconnection in iframes/proxies
export const db: Firestore = (() => {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } catch {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
})();

// Initialize Auth
export const auth = getAuth(app);

// Error Handling Definition
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Quota exhaustion tracking
let isQuotaExhaustedState = false;
const quotaListeners: ((exhausted: boolean, message?: string) => void)[] = [];

export function isQuotaExhaustedError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  return (
    err.code === 'resource-exhausted' ||
    (typeof err.message === 'string' && (
      err.message.includes('Quota limit exceeded') ||
      err.message.includes('resource-exhausted') ||
      err.message.includes('Free daily write units')
    ))
  );
}

export function subscribeQuotaStatus(cb: (exhausted: boolean, message?: string) => void) {
  quotaListeners.push(cb);
  cb(isQuotaExhaustedState);
  return () => {
    const idx = quotaListeners.indexOf(cb);
    if (idx !== -1) quotaListeners.splice(idx, 1);
  };
}

export function getQuotaStatus(): { isExhausted: boolean } {
  return { isExhausted: isQuotaExhaustedState };
}

export function resetQuotaStatus() {
  isQuotaExhaustedState = false;
  quotaListeners.forEach(cb => cb(false));
}

export function triggerQuotaExhausted(message?: string) {
  isQuotaExhaustedState = true;
  quotaListeners.forEach(cb => cb(true, message));
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaExhaustedError(error)) {
    triggerQuotaExhausted('Google Cloud Firestore free tier daily write limit reached (20,000 writes/day). Read access and local caching remain active.');
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

// Interactive diagnostic function for admin health & quota inspection
export async function testFirestoreConnection(): Promise<{
  healthy: boolean;
  writeQuotaAvailable: boolean;
  latencyMs: number;
  message: string;
  details?: string;
}> {
  const startTime = Date.now();
  try {
    // 1. Test Read capability
    const testDocRef = doc(db, SETTINGS_COL, 'main');
    await getDoc(testDocRef);

    // 2. Test Write probe
    const probeDocRef = doc(db, '_quota_probe', 'health_check');
    await setDoc(probeDocRef, { checkedAt: new Date().toISOString() });
    await deleteDoc(probeDocRef);

    isQuotaExhaustedState = false;
    quotaListeners.forEach(cb => cb(false));

    const latency = Date.now() - startTime;
    return {
      healthy: true,
      writeQuotaAvailable: true,
      latencyMs: latency,
      message: 'Cloud Firestore database connection is active and write quota is within normal limits (20,000 free writes/day).'
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    if (isQuotaExhaustedError(error)) {
      triggerQuotaExhausted();
      return {
        healthy: true,
        writeQuotaAvailable: false,
        latencyMs: latency,
        message: 'Google Cloud Firestore daily write quota limit reached (20,000 writes/day). The library is operating in offline-first cache mode.',
        details: error?.message || String(error)
      };
    }
    return {
      healthy: false,
      writeQuotaAvailable: false,
      latencyMs: latency,
      message: `Database ping returned notice: ${error?.message || String(error)}`,
      details: error?.message || String(error)
    };
  }
}
testFirestoreConnection().catch(() => {});

// Collection References
const BOOKS_COL = 'books';
const USERS_COL = 'users';
const LOANS_COL = 'loans';
const RESERVATIONS_COL = 'reservations';
const SETTINGS_COL = 'settings';

/**
 * Initialize / Seed Firestore if empty (guarded against repeated queries and quota checks)
 */
export async function initializeDatabaseIfEmpty() {
  if (typeof window !== 'undefined' && localStorage.getItem('library_db_initialized_v2')) {
    return;
  }

  try {
    const booksSnap = await getDocs(collection(db, BOOKS_COL));
    if (booksSnap.empty) {
      console.log('Seeding initial library books...');
      for (const book of sampleBooks) {
        await setDoc(doc(db, BOOKS_COL, book.id), book);
      }
    }

    const usersSnap = await getDocs(collection(db, USERS_COL));
    if (usersSnap.empty) {
      console.log('Seeding initial library users...');
      for (const user of sampleUsers) {
        await setDoc(doc(db, USERS_COL, user.id), user);
      }
    } else {
      // Ensure super admin account exists in Firestore
      const superAdminRef = doc(db, USERS_COL, "user-superadmin-fmagoodhoo");
      const superAdminSnap = await getDoc(superAdminRef);
      if (!superAdminSnap.exists()) {
        await setDoc(superAdminRef, {
          id: "user-superadmin-fmagoodhoo",
          email: "library@fmagoodhooschool.edu.mv",
          name: "Super Admin (F. Magoodhoo School Library)",
          role: "admin",
          createdAt: "2026-08-04"
        });
      }
    }

    const loansSnap = await getDocs(collection(db, LOANS_COL));
    if (loansSnap.empty) {
      console.log('Seeding initial library loans...');
      for (const loan of sampleLoans) {
        await setDoc(doc(db, LOANS_COL, loan.id), loan);
      }
    }

    const resSnap = await getDocs(collection(db, RESERVATIONS_COL));
    if (resSnap.empty) {
      console.log('Seeding initial reservations...');
      for (const res of sampleReservations) {
        await setDoc(doc(db, RESERVATIONS_COL, res.id), res);
      }
    }

    const settingsDoc = await getDoc(doc(db, SETTINGS_COL, 'main'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, SETTINGS_COL, 'main'), initialSettings);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('library_db_initialized_v2', 'true');
    }
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      triggerQuotaExhausted('Google Cloud Firestore free tier daily write limit reached (20,000 writes/day). The library is running in offline cache mode.');
    }
    console.warn('Database initialization note:', error);
  }
}

// --------------------------------------------------------------------------
// Real-time Firestore Listeners & CRUD
// --------------------------------------------------------------------------

// 1. BOOKS
export function subscribeBooks(callback: (books: Book[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, BOOKS_COL),
    (snapshot) => {
      const books: Book[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Book));
      callback(books);
    },
    (err) => {
      console.warn('Firestore subscribeBooks error:', err);
      if (onError) onError(err);
    }
  );
}

export async function addBook(book: Omit<Book, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, BOOKS_COL), book);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, BOOKS_COL);
    throw err;
  }
}

export async function updateBook(id: string, data: Partial<Book>) {
  try {
    await updateDoc(doc(db, BOOKS_COL, id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${BOOKS_COL}/${id}`);
    throw err;
  }
}

export async function deleteBook(id: string) {
  try {
    await deleteDoc(doc(db, BOOKS_COL, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${BOOKS_COL}/${id}`);
    throw err;
  }
}

// 2. USERS / MEMBERS
export function subscribeUsers(callback: (users: UserProfile[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, USERS_COL),
    (snapshot) => {
      const users: UserProfile[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as UserProfile));
      callback(users);
    },
    (err) => {
      console.warn('Firestore subscribeUsers error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserProfile(user: UserProfile) {
  try {
    await setDoc(doc(db, USERS_COL, user.id), user, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${USERS_COL}/${user.id}`);
    if (!isQuotaExhaustedError(err)) {
      throw err;
    }
  }
}

export async function createUserProfile(user: Omit<UserProfile, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, USERS_COL), user);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, USERS_COL);
    throw err;
  }
}

export async function updateUserProfile(id: string, data: Partial<UserProfile>) {
  try {
    await updateDoc(doc(db, USERS_COL, id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${id}`);
    throw err;
  }
}

export async function deleteUserProfile(id: string) {
  try {
    await deleteDoc(doc(db, USERS_COL, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${USERS_COL}/${id}`);
    throw err;
  }
}

// 3. LOANS
export function subscribeLoans(callback: (loans: Loan[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, LOANS_COL),
    (snapshot) => {
      const loans: Loan[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Loan));
      callback(loans);
    },
    (err) => {
      console.warn('Firestore subscribeLoans error:', err);
      if (onError) onError(err);
    }
  );
}

export async function createLoan(loan: Omit<Loan, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, LOANS_COL), loan);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, LOANS_COL);
    throw err;
  }
}

export async function updateLoan(id: string, data: Partial<Loan>) {
  try {
    await updateDoc(doc(db, LOANS_COL, id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LOANS_COL}/${id}`);
    throw err;
  }
}

// 4. RESERVATIONS
export function subscribeReservations(callback: (reservations: Reservation[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, RESERVATIONS_COL),
    (snapshot) => {
      const reservations: Reservation[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Reservation));
      callback(reservations);
    },
    (err) => {
      console.warn('Firestore subscribeReservations error:', err);
      if (onError) onError(err);
    }
  );
}

export async function createReservation(res: Omit<Reservation, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, RESERVATIONS_COL), res);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, RESERVATIONS_COL);
    throw err;
  }
}

export async function updateReservation(id: string, data: Partial<Reservation>) {
  try {
    await updateDoc(doc(db, RESERVATIONS_COL, id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${RESERVATIONS_COL}/${id}`);
    throw err;
  }
}

export async function cancelReservation(id: string) {
  try {
    await deleteDoc(doc(db, RESERVATIONS_COL, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${RESERVATIONS_COL}/${id}`);
    throw err;
  }
}

// 5. SETTINGS
export function subscribeSettings(callback: (settings: LibrarySettings) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    doc(db, SETTINGS_COL, 'main'),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as LibrarySettings);
      } else {
        callback(initialSettings);
      }
    },
    (err) => {
      console.warn('Firestore subscribeSettings error:', err);
      if (onError) onError(err);
    }
  );
}

export async function updateSettings(settings: Partial<LibrarySettings>) {
  try {
    await setDoc(doc(db, SETTINGS_COL, 'main'), settings, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${SETTINGS_COL}/main`);
    throw err;
  }
}
