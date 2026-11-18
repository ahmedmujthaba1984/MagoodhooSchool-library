import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { sampleUsers } from '../data/seedData';
import { resolveAccessRole } from '../lib/rbac';
import { signInWithGooglePopup, signOutFirebase, subscribeAuthState } from '../lib/firebase';

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

function readInitialSessionUser(): UserProfile {
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
    // Ignore malformed session storage
  }
  return sampleUsers[0];
}

export interface DeskPinMatchResult {
  matched: boolean;
  user?: UserProfile;
}

export interface AuthContextValue {
  currentUser: UserProfile;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  loginWithProfile: (user: UserProfile) => void;
  loginWithGoogle: (allUsers: UserProfile[]) => Promise<UserProfile>;
  loginWithDeskPin: (pin: string, allUsers: UserProfile[]) => DeskPinMatchResult;
  enterGuestMode: () => void;
  logout: () => Promise<void>;
  syncWithDirectory: (allUsers: UserProfile[]) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<UserProfile>(() => readInitialSessionUser());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const persistSession = useCallback((user: UserProfile) => {
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore quota errors
    }
  }, []);

  const setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>> = useCallback(
    (updater) => {
      setCurrentUserState((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: UserProfile) => UserProfile)(prev) : updater;
        persistSession(next);
        return next;
      });
    },
    [persistSession]
  );

  useEffect(() => {
    const unsubscribe = subscribeAuthState((fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsubscribe();
  }, []);

  const loginWithProfile = useCallback(
    (user: UserProfile) => {
      setCurrentUser(user);
    },
    [setCurrentUser]
  );

  const loginWithGoogle = useCallback(
    async (allUsers: UserProfile[]): Promise<UserProfile> => {
      const fbUser = await signInWithGooglePopup();
      setFirebaseUser(fbUser);
      const emailLower = (fbUser.email || '').toLowerCase();
      const matched = allUsers.find((u) => u.email.toLowerCase() === emailLower);
      if (matched) {
        setCurrentUser(matched);
        return matched;
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
      setCurrentUser(fallbackStaff);
      return fallbackStaff;
    },
    [setCurrentUser]
  );

  const loginWithDeskPin = useCallback(
    (pin: string, allUsers: UserProfile[]): DeskPinMatchResult => {
      const cleanPin = pin.trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return { matched: false };
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
            (u.phone && u.phone.replace(/\D/g, '').endsWith(cleanPin))
        );
      }

      if (!matchedUser) {
        return { matched: false };
      }

      setCurrentUser(matchedUser);
      return { matched: true, user: matchedUser };
    },
    [setCurrentUser]
  );

  const enterGuestMode = useCallback(() => {
    setCurrentUser(GUEST_USER);
  }, [setCurrentUser]);

  const logout = useCallback(async () => {
    try {
      await signOutFirebase();
    } catch {
      // Ignore if not signed in via Firebase popup
    }
    setCurrentUser(GUEST_USER);
  }, [setCurrentUser]);

  const syncWithDirectory = useCallback(
    (allUsers: UserProfile[]) => {
      setCurrentUserState((prev) => {
        if (!prev || prev.id === 'guest') return prev;
        const fresh = allUsers.find((u) => u.id === prev.id);
        if (!fresh) return prev;
        if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev;
        persistSession(fresh);
        return fresh;
      });
    },
    [persistSession]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isAuthenticated: currentUser.id !== 'guest',
        isGuest: currentUser.id === 'guest',
        setCurrentUser,
        loginWithProfile,
        loginWithGoogle,
        loginWithDeskPin,
        enterGuestMode,
        logout,
        syncWithDirectory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
