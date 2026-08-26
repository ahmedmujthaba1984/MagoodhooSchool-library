import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
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

// Initialize Firestore (handling custom database ID if present)
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Collection References
const BOOKS_COL = 'books';
const USERS_COL = 'users';
const LOANS_COL = 'loans';
const RESERVATIONS_COL = 'reservations';
const SETTINGS_COL = 'settings';

/**
 * Initialize / Seed Firestore if empty
 */
export async function initializeDatabaseIfEmpty() {
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
  } catch (error) {
    console.error('Error during database initialization/seeding:', error);
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
  const docRef = await addDoc(collection(db, BOOKS_COL), book);
  return docRef.id;
}

export async function updateBook(id: string, data: Partial<Book>) {
  await updateDoc(doc(db, BOOKS_COL, id), data);
}

export async function deleteBook(id: string) {
  await deleteDoc(doc(db, BOOKS_COL, id));
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
  await setDoc(doc(db, USERS_COL, user.id), user, { merge: true });
}

export async function createUserProfile(user: Omit<UserProfile, 'id'>) {
  const docRef = await addDoc(collection(db, USERS_COL), user);
  return docRef.id;
}

export async function updateUserProfile(id: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, USERS_COL, id), data);
}

export async function deleteUserProfile(id: string) {
  await deleteDoc(doc(db, USERS_COL, id));
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
  const docRef = await addDoc(collection(db, LOANS_COL), loan);
  return docRef.id;
}

export async function updateLoan(id: string, data: Partial<Loan>) {
  await updateDoc(doc(db, LOANS_COL, id), data);
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
  const docRef = await addDoc(collection(db, RESERVATIONS_COL), res);
  return docRef.id;
}

export async function updateReservation(id: string, data: Partial<Reservation>) {
  await updateDoc(doc(db, RESERVATIONS_COL, id), data);
}

export async function cancelReservation(id: string) {
  await deleteDoc(doc(db, RESERVATIONS_COL, id));
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
  await setDoc(doc(db, SETTINGS_COL, 'main'), settings, { merge: true });
}
