import type { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { sampleUsers } from '../data/seedData';
import { resolveAccessRole } from '../lib/rbac';
import {
  signInWithGooglePopup,
  signOutFirebase,
  subscribeAuthState,
} from '../lib/firebase';

export const AUTH_SESSION_STORAGE_KEY = 'magoodhoo_auth_session_v1';

export const GUEST_USER: UserProfile = {
  id: 'guest',
  name: 'Guest Visitor',
  dhivehiName: 'މެހެމާނު',
  email: 'guest@magoodhooschool.edu.mv',
  role: 'student',
  accessRole: 'student_guest',
  patronTier: 'external',
  createdAt: new Date().toISOString().split('T')[0],
};

export interface AuthMatchResult {
  matched: boolean;
  user?: UserProfile;
  reason?: string;
}

function cleanDigits(str: string): string {
  return (str || '').replace(/\D/g, '');
}

export function readInitialSessionUser(): UserProfile {
  if (typeof window === 'undefined') return sampleUsers[0];
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserProfile;
      if (parsed && parsed.id && parsed.name) {
        return parsed;
      }
    }
  } catch {
    // Ignore malformed session cache
  }
  return sampleUsers[0];
}

export function persistSessionUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSessionUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function subscribeFirebaseAuth(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return subscribeAuthState(callback);
}

/**
 * Signs in via Firebase Google SSO popup and reconciles the account
 * against the school patron/staff directory.
 */
export async function signInWithGoogleDirectory(
  allUsers: UserProfile[]
): Promise<{ firebaseUser: FirebaseUser; profile: UserProfile }> {
  const fbUser = await signInWithGooglePopup();
  const emailLower = (fbUser.email || '').toLowerCase();
  const matched = allUsers.find((u) => (u.email || '').toLowerCase() === emailLower);

  if (matched) {
    persistSessionUser(matched);
    return { firebaseUser: fbUser, profile: matched };
  }

  const fallbackStaff: UserProfile = {
    id: fbUser.uid || `fb-${Date.now()}`,
    email: fbUser.email || 'staff@fmagoodhooschool.edu.mv',
    name: fbUser.displayName || 'School Staff (Google SSO)',
    role: 'admin',
    accessRole: 'super_admin',
    patronTier: 'staff',
    photoUrl: fbUser.photoURL || undefined,
    staffDepartment: 'Library & Administration',
    createdAt: new Date().toISOString().split('T')[0],
  };
  persistSessionUser(fallbackStaff);
  return { firebaseUser: fbUser, profile: fallbackStaff };
}

/**
 * Resolves a 4-digit Circulation Desk Quick-Switch PIN against active library staff
 * or directory ID suffixes for shared circulation computers.
 */
export function resolveDeskPinUser(
  pin: string,
  allUsers: UserProfile[]
): AuthMatchResult {
  const cleanPin = (pin || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { matched: false, reason: 'Enter a valid 4-digit numeric desk PIN.' };
  }

  let matchedUser: UserProfile | undefined;
  if (cleanPin === '0000') {
    matchedUser =
      allUsers.find((u) => resolveAccessRole(u) === 'super_admin') || sampleUsers[0];
  } else if (cleanPin === '1111') {
    matchedUser =
      allUsers.find((u) => resolveAccessRole(u) === 'desk_assistant') ||
      allUsers.find((u) => u.role === 'staff');
  } else if (cleanPin === '2222') {
    matchedUser = allUsers.find((u) => resolveAccessRole(u) === 'teacher');
  } else if (cleanPin === '4444') {
    matchedUser = allUsers.find((u) => u.role === 'parent');
  } else {
    matchedUser = allUsers.find(
      (u) =>
        (u.studentIdCode && u.studentIdCode.endsWith(cleanPin)) ||
        (u.staffIdCode && u.staffIdCode.endsWith(cleanPin)) ||
        (u.phone && cleanDigits(u.phone).endsWith(cleanPin))
    );
  }

  if (!matchedUser) {
    return { matched: false, reason: 'No active desk account matches this 4-digit PIN.' };
  }

  return { matched: true, user: matchedUser };
}

export function findDirectoryUserByIdentifier(
  identifier: string,
  pool: UserProfile[]
): UserProfile | null {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return null;
  const digits = cleanDigits(clean);

  return (
    pool.find((u) => {
      if ((u.email || '').toLowerCase() === clean) return true;
      if ((u.studentIdCode || '').toLowerCase() === clean) return true;
      if ((u.staffIdCode || '').toLowerCase() === clean) return true;
      if (digits.length >= 4 && u.phone && cleanDigits(u.phone).endsWith(digits)) return true;
      if ((u.name || '').toLowerCase() === clean) return true;
      return false;
    }) || null
  );
}

export function authenticateStaff(
  identifier: string,
  passwordOrPin: string,
  allUsers: UserProfile[]
): AuthMatchResult {
  const staffPool = allUsers.filter(
    (u) => u.role === 'admin' || u.role === 'staff' || resolveAccessRole(u) === 'teacher'
  );
  const user = findDirectoryUserByIdentifier(identifier, staffPool);
  if (!user) {
    return { matched: false, reason: 'Staff email or ID not found in directory.' };
  }
  if (!passwordOrPin || passwordOrPin.trim().length < 4) {
    return { matched: false, reason: 'Enter at least 4 characters for your password or PIN.' };
  }
  return { matched: true, user };
}

export function authenticateStudent(
  indexOrBarcode: string,
  pin: string,
  allUsers: UserProfile[]
): AuthMatchResult {
  const studentPool = allUsers.filter((u) => u.role === 'student');
  const user = findDirectoryUserByIdentifier(indexOrBarcode, studentPool);
  if (!user) {
    return { matched: false, reason: 'Student Index or Library Barcode ID not found.' };
  }
  if (!pin || pin.trim().length < 4) {
    return { matched: false, reason: 'Enter your 4-digit school PIN.' };
  }
  return { matched: true, user };
}

export function findParentByIdentifier(
  phoneOrEmail: string,
  allUsers: UserProfile[]
): UserProfile | null {
  const parentPool = allUsers.filter((u) => u.role === 'parent');
  return findDirectoryUserByIdentifier(phoneOrEmail, parentPool);
}

export function generateParentOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function signOutSession(): Promise<void> {
  try {
    await signOutFirebase();
  } catch {
    // Safe fallback if user signed in via local PIN/directory session
  }
  persistSessionUser(GUEST_USER);
}
